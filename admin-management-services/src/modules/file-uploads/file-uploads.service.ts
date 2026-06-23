import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { plainToClass } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { AppDataSource } from '../../config/database';
import { ProductsAdminService } from '../products/products.service';
import { CustomerAdminService } from '../customers/customer.service';
import { VendorAdminService } from '../vendors/vendor.service';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { UpdateCustomerDto } from '../customers/dto/update-customer.dto';
import { CreateVendorDto } from '../vendors/dto/create-vendor.dto';
import { UpdateVendorDto } from '../vendors/dto/update-vendor.dto';
import { AdminBulkUploadJob, type BulkUploadRowError } from './entities/AdminBulkUploadJob';
import { normalizeMediaUrl, normalizeMediaUrlList } from '../../util/normalizeMediaUrl';
import { adminUploadRoot } from '../../config/uploadPaths';

const UPLOAD_DIR = adminUploadRoot();
const MAX_ROWS = 500;
const MAX_ERRORS_STORED = 100;

export const SAMPLE_PRODUCT_CSV = `id,name,vendor_id,category_id,sell_price,discount_amount,final_price,thumbnail_url,image_urls,short_description,long_description,is_active,attr1_name,attr1_value
,Sample New Product,,,199,0,199,,https://example.com/a.jpg|https://example.com/b.jpg,Short text,Longer description,true,Color,Red
`;

export const SAMPLE_CUSTOMER_CSV = `id,full_name,email,phone,status,occupation_id,keycloak_user_id
,Jane Customer,jane@example.com,9876500000,active,,
`;

export const SAMPLE_VENDOR_CSV = `id,business_name,owner_name,phone,email,vendor_kind,status
,CSV Demo Vendor,Owner Name,9876500001,demo@vendor.com,product,not_verified
`;

function validationMsgs(errors: ValidationError[]): string {
  return errors
    .map(e => Object.values(e.constraints || {}))
    .flat()
    .join('; ');
}

function normalizeRow(rec: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec)) {
    const nk = k.trim().toLowerCase().replace(/\s+/g, '_');
    out[nk] = v == null ? '' : String(v).trim();
  }
  return out;
}

function pick(r: Record<string, string>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== '') return v;
  }
  return undefined;
}

function boolCell(v: string | undefined): boolean | undefined {
  if (v === undefined || v === '') return undefined;
  const s = v.toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(s)) return true;
  if (['0', 'false', 'no', 'n'].includes(s)) return false;
  return undefined;
}

function intCell(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

export class FileUploadsAdminService {
  private products = new ProductsAdminService();
  private customers = new CustomerAdminService();
  private vendors = new VendorAdminService();

  private jobRepo() {
    return AppDataSource.getRepository(AdminBulkUploadJob);
  }

  async listJobs(limit: number, offset: number): Promise<{ items: AdminBulkUploadJob[]; total: number }> {
    const repo = this.jobRepo();
    const [items, total] = await repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async getJob(id: string): Promise<AdminBulkUploadJob | null> {
    return this.jobRepo().findOne({ where: { id } });
  }

  getSampleCsv(uploadType: string): { filename: string; body: string } {
    const t = uploadType.toLowerCase();
    if (t === 'customer' || t === 'customers') {
      return { filename: 'sample-customers.csv', body: SAMPLE_CUSTOMER_CSV };
    }
    if (t === 'vendor' || t === 'vendors') {
      return { filename: 'sample-vendors.csv', body: SAMPLE_VENDOR_CSV };
    }
    return { filename: 'sample-products.csv', body: SAMPLE_PRODUCT_CSV };
  }

  resolveStoredPath(job: AdminBulkUploadJob): string {
    return path.join(UPLOAD_DIR, job.storedRelativePath);
  }

  async createJobAndSaveFile(
    uploadType: string,
    originalFilename: string,
    diskPath: string,
    actorSub: string | undefined
  ): Promise<AdminBulkUploadJob> {
    const id = path.basename(diskPath, path.extname(diskPath));
    const rel = path.relative(UPLOAD_DIR, diskPath).replace(/\\/g, '/');
    const repo = this.jobRepo();
    const row = repo.create({
      id,
      uploadType: uploadType.toLowerCase(),
      originalFilename: originalFilename || 'upload.csv',
      storedRelativePath: rel,
      status: 'processing',
      totalRows: 0,
      successCount: 0,
      errorCount: 0,
      resultDetail: null,
      actorSub: actorSub ?? null,
    });
    await repo.save(row);
    return row;
  }

  async processJob(jobId: string, actorSub: string, ip: string | undefined): Promise<AdminBulkUploadJob> {
    const repo = this.jobRepo();
    const job = await repo.findOne({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');
    const abs = this.resolveStoredPath(job);
    if (!fs.existsSync(abs)) throw new Error('Uploaded file missing');

    const raw = fs.readFileSync(abs, 'utf8');
    let records: Record<string, unknown>[];
    try {
      records = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
        bom: true,
      }) as Record<string, unknown>[];
    } catch (e: any) {
      job.status = 'failed';
      job.totalRows = 0;
      job.successCount = 0;
      job.errorCount = 0;
      job.resultDetail = { rowErrors: [{ row: 0, message: e.message || 'CSV parse failed' }] };
      await repo.save(job);
      return job;
    }

    if (records.length > MAX_ROWS) {
      job.status = 'failed';
      job.totalRows = records.length;
      job.successCount = 0;
      job.errorCount = records.length;
      job.resultDetail = {
        rowErrors: [{ row: 0, message: `Too many rows (max ${MAX_ROWS}). Split the file.` }],
      };
      await repo.save(job);
      return job;
    }

    const rowErrors: BulkUploadRowError[] = [];
    let success = 0;
    const type = job.uploadType;

    for (let i = 0; i < records.length; i++) {
      const rowNum = i + 2;
      const r = normalizeRow(records[i]);
      try {
        if (type === 'product' || type === 'products') {
          await this.processProductRow(r, actorSub, ip);
        } else if (type === 'customer' || type === 'customers') {
          await this.processCustomerRow(r, actorSub, ip);
        } else if (type === 'vendor' || type === 'vendors') {
          await this.processVendorRow(r, actorSub, ip);
        } else {
          throw new Error(`Unknown upload type: ${type}`);
        }
        success++;
      } catch (e: any) {
        const msg = e instanceof Error ? e.message : String(e);
        if (rowErrors.length < MAX_ERRORS_STORED) rowErrors.push({ row: rowNum, message: msg });
      }
    }

    const total = records.length;
    const errors = total - success;
    job.totalRows = total;
    job.successCount = success;
    job.errorCount = errors;
    job.resultDetail = rowErrors.length ? { rowErrors } : null;
    if (errors === 0 && total > 0) job.status = 'completed';
    else if (success > 0 && errors > 0) job.status = 'partial';
    else if (total === 0) {
      job.status = 'failed';
      job.resultDetail = { rowErrors: [{ row: 0, message: 'No data rows in CSV' }] };
    } else job.status = 'partial';

    await repo.save(job);
    return job;
  }

  private async processProductRow(r: Record<string, string>, actorSub: string, ip: string | undefined): Promise<void> {
    const id = pick(r, 'id');
    const name = pick(r, 'name', 'product_name', 'title');
    const urls = (pick(r, 'image_urls', 'images', 'gallery_urls') || '')
      .split('|')
      .map(s => s.trim())
      .filter(Boolean)
      .map((u) => normalizeMediaUrl(u) ?? u);
    const explicitThumb = normalizeMediaUrl(pick(r, 'thumbnail_url', 'thumb') || null);
    const thumbnailUrl = explicitThumb || urls[0] || undefined;
    const bannerUrls =
      urls.length === 0
        ? undefined
        : explicitThumb
          ? urls
          : urls.length > 1
            ? urls.slice(1)
            : undefined;

    const attrs: { name: string; value: string }[] = [];
    for (let i = 1; i <= 5; i++) {
      const an = pick(r, `attr${i}_name`, `attribute_${i}_name`);
      const av = pick(r, `attr${i}_value`, `attribute_${i}_value`);
      if (an && av) attrs.push({ name: an, value: av });
    }
    const metadata = attrs.length ? ({ bulkImportAttributes: attrs } as Record<string, unknown>) : undefined;

    const base: Record<string, unknown> = {
      name: name || undefined,
      availability: boolCell(pick(r, 'availability', 'available')),
      vendorId: pick(r, 'vendor_id') || null,
      categoryId: pick(r, 'category_id') || null,
      serviceId: pick(r, 'service_id') || null,
      sellPrice: pick(r, 'sell_price'),
      discountAmount: pick(r, 'discount_amount'),
      finalPrice: pick(r, 'final_price'),
      taxConfigurationId: pick(r, 'tax_configuration_id') || null,
      durationHours: intCell(pick(r, 'duration_hours')),
      durationMinutes: intCell(pick(r, 'duration_minutes')),
      shortDescription: pick(r, 'short_description'),
      longDescription: pick(r, 'long_description'),
      promiseP4u: pick(r, 'promise_p4u'),
      helpLineNumber: pick(r, 'help_line_number'),
      thumbnailUrl: thumbnailUrl ?? null,
      bannerUrls: bannerUrls ?? null,
      description: pick(r, 'description'),
      price: pick(r, 'price'),
      isActive: boolCell(pick(r, 'is_active')),
      metadata,
    };

    const hasId = !!(id && id.length >= 32);
    if (hasId) {
      const dto = plainToClass(UpdateProductDto, base);
      const errors = await validate(dto);
      if (errors.length) throw new Error(validationMsgs(errors));
      await this.products.updateProduct(id!, dto, actorSub, ip);
    } else {
      if (!name) throw new Error('name is required to create a product');
      const dto = plainToClass(CreateProductDto, { ...base, name });
      const errors = await validate(dto);
      if (errors.length) throw new Error(validationMsgs(errors));
      await this.products.createProduct(dto, actorSub, ip);
    }
  }

  private async processCustomerRow(r: Record<string, string>, actorSub: string, ip: string | undefined): Promise<void> {
    const id = pick(r, 'id');
    const fullName = pick(r, 'full_name', 'fullname');
    const dto = plainToClass(UpdateCustomerDto, {
      fullName: fullName || undefined,
      email: pick(r, 'email') || null,
      phone: pick(r, 'phone') || null,
      status: pick(r, 'status'),
      occupationId: pick(r, 'occupation_id') || null,
      keycloakUserId: pick(r, 'keycloak_user_id') || null,
    });
    const errors = await validate(dto);
    if (errors.length) throw new Error(validationMsgs(errors));

    if (id && id.length >= 32) {
      await this.customers.updateCustomer(id, dto, actorSub, ip);
    } else {
      if (!fullName) throw new Error('full_name is required to create a customer');
      await this.customers.createCustomer({ ...dto, fullName }, actorSub, ip);
    }
  }

  private async processVendorRow(r: Record<string, string>, actorSub: string, ip: string | undefined): Promise<void> {
    const id = pick(r, 'id');
    const vkRaw = (pick(r, 'vendor_kind', 'vendor_type', 'vendorkind') || 'product').toLowerCase();
    const vendorKind = vkRaw === 'service' ? 'service' : 'product';

    if (id && id.length >= 32) {
      const dto = plainToClass(UpdateVendorDto, {
        businessName: pick(r, 'business_name'),
        ownerName: pick(r, 'owner_name'),
        phone: pick(r, 'phone'),
        email: pick(r, 'email'),
        status: pick(r, 'status') as any,
        vendorKind,
      });
      const errors = await validate(dto);
      if (errors.length) throw new Error(validationMsgs(errors));
      await this.vendors.updateVendor(id, dto, actorSub, ip);
    } else {
      const businessName = pick(r, 'business_name');
      if (!businessName) throw new Error('business_name is required to create a vendor');
      const dto = plainToClass(CreateVendorDto, {
        businessName,
        ownerName: pick(r, 'owner_name'),
        phone: pick(r, 'phone'),
        email: pick(r, 'email'),
        status: pick(r, 'status') as any,
        vendorKind,
      });
      const errors = await validate(dto);
      if (errors.length) throw new Error(validationMsgs(errors));
      await this.vendors.createVendor(dto, actorSub, ip);
    }
  }

  async retryJob(jobId: string, actorSub: string, ip: string | undefined): Promise<AdminBulkUploadJob> {
    const repo = this.jobRepo();
    const job = await repo.findOne({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');
    job.status = 'processing';
    job.totalRows = 0;
    job.successCount = 0;
    job.errorCount = 0;
    job.resultDetail = null;
    await repo.save(job);
    return this.processJob(jobId, actorSub, ip);
  }
}
