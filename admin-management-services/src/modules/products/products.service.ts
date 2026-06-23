import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { Product } from './entities/Product';
import { ProductRequest } from './entities/ProductRequest';
import { TaxConfiguration } from './entities/TaxConfiguration';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductRequestDto } from './dto/update-product-request.dto';
import { CreateTaxConfigurationDto } from './dto/create-tax-configuration.dto';
import { UpdateTaxConfigurationDto } from './dto/update-tax-configuration.dto';
import { CommerceReview } from './entities/CommerceReview';
import { normalizeMediaUrl, normalizeMediaUrlList } from '../../util/normalizeMediaUrl';

export class ProductsAdminService {
  private audit = new AuditService();

  async listProducts(limit: number, offset: number): Promise<{ items: Product[]; total: number }> {
    const repo = AppDataSource.getRepository(Product);
    const [items, total] = await repo.findAndCount({ order: { createdAt: 'DESC' }, take: limit, skip: offset });
    return { items, total };
  }

  async getProduct(id: string): Promise<Product | null> {
    return AppDataSource.getRepository(Product).findOne({ where: { id } });
  }

  async getProductRequest(id: string): Promise<ProductRequest | null> {
    return AppDataSource.getRepository(ProductRequest).findOne({ where: { id } });
  }

  async createProduct(dto: CreateProductDto, actorSub: string, ip: string | undefined): Promise<Product> {
    const repo = AppDataSource.getRepository(Product);
    const row = repo.create({
      name: dto.name,
      availability: dto.availability ?? false,
      vendorId: dto.vendorId ?? null,
      categoryId: dto.categoryId ?? null,
      serviceId: dto.serviceId ?? null,
      sellPrice: dto.sellPrice ?? '0',
      discountAmount: dto.discountAmount ?? '0',
      finalPrice: dto.finalPrice ?? '0',
      taxConfigurationId: dto.taxConfigurationId ?? null,
      durationHours: dto.durationHours ?? 0,
      durationMinutes: dto.durationMinutes ?? 0,
      shortDescription: dto.shortDescription ?? null,
      longDescription: dto.longDescription ?? null,
      promiseP4u: dto.promiseP4u ?? null,
      helpLineNumber: dto.helpLineNumber ?? null,
      thumbnailUrl: normalizeMediaUrl(dto.thumbnailUrl ?? null),
      bannerUrls: normalizeMediaUrlList(dto.bannerUrls ?? null),
      commissionOverridePercent: dto.commissionOverridePercent ?? null,
      description: dto.description ?? null,
      price: dto.price ?? '0',
      isActive: dto.isActive ?? true,
      moderationStatus: dto.moderationStatus ?? 'approved',
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'Product', entityId: row.id, metadata: { name: row.name }, ipAddress: ip ?? null });
    return row;
  }

  async updateProduct(id: string, dto: UpdateProductDto, actorSub: string, ip: string | undefined): Promise<Product> {
    const repo = AppDataSource.getRepository(Product);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Product not found');
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.availability !== undefined) row.availability = dto.availability;
    if (dto.vendorId !== undefined) row.vendorId = dto.vendorId;
    if (dto.categoryId !== undefined) row.categoryId = dto.categoryId;
    if (dto.serviceId !== undefined) row.serviceId = dto.serviceId;
    if (dto.sellPrice !== undefined) row.sellPrice = dto.sellPrice;
    if (dto.discountAmount !== undefined) row.discountAmount = dto.discountAmount;
    if (dto.finalPrice !== undefined) row.finalPrice = dto.finalPrice;
    if (dto.taxConfigurationId !== undefined) row.taxConfigurationId = dto.taxConfigurationId;
    if (dto.durationHours !== undefined) row.durationHours = dto.durationHours;
    if (dto.durationMinutes !== undefined) row.durationMinutes = dto.durationMinutes;
    if (dto.shortDescription !== undefined) row.shortDescription = dto.shortDescription;
    if (dto.longDescription !== undefined) row.longDescription = dto.longDescription;
    if (dto.promiseP4u !== undefined) row.promiseP4u = dto.promiseP4u;
    if (dto.helpLineNumber !== undefined) row.helpLineNumber = dto.helpLineNumber;
    if (dto.thumbnailUrl !== undefined) row.thumbnailUrl = normalizeMediaUrl(dto.thumbnailUrl);
    if (dto.bannerUrls !== undefined) row.bannerUrls = normalizeMediaUrlList(dto.bannerUrls);
    if (dto.commissionOverridePercent !== undefined) row.commissionOverridePercent = dto.commissionOverridePercent;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.price !== undefined) row.price = dto.price;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.moderationStatus !== undefined) row.moderationStatus = dto.moderationStatus;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'Product', entityId: row.id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return row;
  }

  async deleteProduct(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(Product);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Product not found');
    await repo.remove(row);
    await this.audit.log({ actorSub, action: 'DELETE', entityType: 'Product', entityId: id, metadata: { name: row.name }, ipAddress: ip ?? null });
  }

  async listTaxConfiguration(includeInactive: boolean): Promise<TaxConfiguration[]> {
    const repo = AppDataSource.getRepository(TaxConfiguration);
    if (includeInactive) return repo.find({ order: { createdAt: 'DESC' } });
    return repo.find({ where: { isActive: true }, order: { createdAt: 'DESC' } });
  }

  async createTaxConfiguration(dto: CreateTaxConfigurationDto, actorSub: string, ip: string | undefined): Promise<TaxConfiguration> {
    const repo = AppDataSource.getRepository(TaxConfiguration);
    const row = repo.create({
      code: dto.code,
      title: dto.title,
      percentage: dto.percentage,
      isActive: dto.isActive ?? true,
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'TaxConfiguration', entityId: row.id, metadata: { code: row.code }, ipAddress: ip ?? null });
    return row;
  }

  async updateTaxConfiguration(id: string, dto: UpdateTaxConfigurationDto, actorSub: string, ip: string | undefined): Promise<TaxConfiguration> {
    const repo = AppDataSource.getRepository(TaxConfiguration);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Tax configuration not found');
    if (dto.code !== undefined) row.code = dto.code;
    if (dto.title !== undefined) row.title = dto.title;
    if (dto.percentage !== undefined) row.percentage = dto.percentage;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'TaxConfiguration', entityId: row.id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return row;
  }

  async deleteTaxConfiguration(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(TaxConfiguration);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Tax configuration not found');
    await repo.remove(row);
    await this.audit.log({ actorSub, action: 'DELETE', entityType: 'TaxConfiguration', entityId: id, metadata: { code: row.code }, ipAddress: ip ?? null });
  }

  async listProductRequests(limit: number, offset: number): Promise<{ items: ProductRequest[]; total: number }> {
    const repo = AppDataSource.getRepository(ProductRequest);
    const [items, total] = await repo.findAndCount({ order: { createdAt: 'DESC' }, take: limit, skip: offset });
    return { items, total };
  }

  async updateProductRequest(id: string, dto: UpdateProductRequestDto, actorSub: string, ip: string | undefined): Promise<ProductRequest> {
    const repo = AppDataSource.getRepository(ProductRequest);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Product request not found');
    if (dto.vendorId !== undefined) row.vendorId = dto.vendorId;
    if (dto.categoryId !== undefined) row.categoryId = dto.categoryId;
    if (dto.taxConfigurationId !== undefined) row.taxConfigurationId = dto.taxConfigurationId;
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.payload !== undefined) row.payload = dto.payload;
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'ProductRequest', entityId: row.id, metadata: { changes: dto }, ipAddress: ip ?? null });
    return row;
  }

  async batchRelinkProductsForTaxConfiguration(id: string, actorSub: string, ip: string | undefined): Promise<{ taxConfigurationId: string; updated: number }> {
    const result = await AppDataSource.getRepository(Product).update({ taxConfigurationId: id }, { taxConfigurationId: null });
    const updated = result.affected ?? 0;
    await this.audit.log({ actorSub, action: 'BATCH_UPDATE', entityType: 'Product', entityId: id, metadata: { batch: 'clear_tax_configuration', updated }, ipAddress: ip ?? null });
    return { taxConfigurationId: id, updated };
  }

  async batchRelinkProductRequestsForTaxConfiguration(id: string, actorSub: string, ip: string | undefined): Promise<{ taxConfigurationId: string; updated: number }> {
    const result = await AppDataSource.getRepository(ProductRequest).update({ taxConfigurationId: id }, { taxConfigurationId: null });
    const updated = result.affected ?? 0;
    await this.audit.log({ actorSub, action: 'BATCH_UPDATE', entityType: 'ProductRequest', entityId: id, metadata: { batch: 'clear_tax_configuration', updated }, ipAddress: ip ?? null });
    return { taxConfigurationId: id, updated };
  }

  async batchProductReviewsCleanup(
    productId: string,
    actorSub: string,
    ip: string | undefined,
  ): Promise<{ productId: string; updated: number; note: string }> {
    const result = await AppDataSource.getRepository(CommerceReview).update(
      { targetType: 'product', targetId: productId },
      { status: 'archived' },
    );
    const updated = result.affected ?? 0;
    await this.audit.log({
      actorSub,
      action: 'BATCH_UPDATE',
      entityType: 'CommerceReview',
      entityId: productId,
      metadata: { batch: 'product_reviews_cleanup', updated },
      ipAddress: ip ?? null,
    });
    return {
      productId,
      updated,
      note: updated > 0 ? 'Product reviews archived.' : 'No reviews matched product.',
    };
  }
}
