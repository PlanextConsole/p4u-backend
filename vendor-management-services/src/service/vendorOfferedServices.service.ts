import { AppDataSource } from '../config/database';
import { Vendor } from '../entities/Vendor';
import { CatalogVendorService } from '../entities/CatalogVendorService';
import { CatalogServiceItem } from '../entities/CatalogServiceItem';
import { ServiceCategory } from '../entities/ServiceCategory';

export type VendorServiceOfferingRow = {
  id: string;
  vendorId: string;
  serviceId: string;
  price: string;
  isAvailable: boolean;
  isActive: boolean;
  moderationStatus: string;
  metadata: Record<string, unknown> | null;
  catalogName: string;
  catalogIconUrl: string | null;
  catalogDescription: string | null;
  catalogMetadata: Record<string, unknown> | null;
  categoryId: string | null;
  categoryName: string | null;
};

export class VendorOfferedServicesService {
  async assertServiceVendor(vendorId: string): Promise<void> {
    const v = await AppDataSource.getRepository(Vendor).findOne({ where: { id: vendorId } });
    if (!v) throw new Error('Vendor not found');
    const vk = String(v.vendorKind || '').toLowerCase();
    const vt = String(v.vendorType || '').toUpperCase();
    if (vk !== 'service' && vt !== 'SERVICE') {
      throw new Error('Only service vendors can manage service offerings');
    }
  }

  async listServiceCategories(): Promise<ServiceCategory[]> {
    return AppDataSource.getRepository(ServiceCategory).find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async listCatalogServiceItems(): Promise<CatalogServiceItem[]> {
    return AppDataSource.getRepository(CatalogServiceItem).find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /** Extract catalog service ids from a vendor's `services_json` (ids, or {id|serviceId|value} objects). */
  private normalizeAssignedServiceIds(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const ids: string[] = [];
    for (const entry of raw) {
      if (entry == null) continue;
      if (typeof entry === 'string' || typeof entry === 'number') {
        const s = String(entry).trim();
        if (s) ids.push(s);
      } else if (typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;
        const id = obj.id ?? obj.serviceId ?? obj.value;
        if (id != null && String(id).trim()) ids.push(String(id).trim());
      }
    }
    return Array.from(new Set(ids));
  }

  /**
   * Back-fill real offerings for services an admin assigned to the vendor via
   * the "edit vendor" screen (stored on `services_json`). Without this, an
   * admin-assigned service is bookable by customers (catalog has a services_json
   * fallback) but never appears in the vendor's own "My Services" list, which
   * reads only `catalog_vendor_services`. Idempotent: only creates links that
   * don't already exist. Admin-assigned ⇒ pre-approved and active.
   */
  private async backfillAdminAssignedOfferings(vendorId: string): Promise<void> {
    const vendor = await AppDataSource.getRepository(Vendor).findOne({ where: { id: vendorId } });
    if (!vendor) return;
    const assignedIds = this.normalizeAssignedServiceIds(vendor.servicesJson);
    if (!assignedIds.length) return;

    const vsRepo = AppDataSource.getRepository(CatalogVendorService);
    const ciRepo = AppDataSource.getRepository(CatalogServiceItem);
    const existing = await vsRepo.find({ where: { vendorId } });
    const have = new Set(existing.map((r) => r.serviceId));

    for (const serviceId of assignedIds) {
      if (have.has(serviceId)) continue;
      const item = await ciRepo.findOne({ where: { id: serviceId } });
      if (!item) continue; // not a real catalog service id — skip
      try {
        await vsRepo.save(
          vsRepo.create({
            vendorId,
            serviceId,
            price: item.basePrice != null ? String(item.basePrice) : '0',
            isAvailable: true,
            isActive: true,
            moderationStatus: 'approved',
            metadata: { assignedByAdmin: true },
          }),
        );
      } catch {
        // Unique (vendorId, serviceId) race or transient error — safe to ignore;
        // the row either already exists or will be picked up on the next load.
      }
    }
  }

  async listOfferings(vendorId: string): Promise<VendorServiceOfferingRow[]> {
    await this.assertServiceVendor(vendorId);
    await this.backfillAdminAssignedOfferings(vendorId);
    const vsRepo = AppDataSource.getRepository(CatalogVendorService);
    const links = await vsRepo.find({ where: { vendorId }, order: { updatedAt: 'DESC' } });
    const ciRepo = AppDataSource.getRepository(CatalogServiceItem);
    const scRepo = AppDataSource.getRepository(ServiceCategory);
    const out: VendorServiceOfferingRow[] = [];
    for (const link of links) {
      const item = await ciRepo.findOne({ where: { id: link.serviceId } });
      const meta =
        link.metadata && typeof link.metadata === 'object' && !Array.isArray(link.metadata)
          ? (link.metadata as Record<string, unknown>)
          : {};
      const metaDisplay =
        typeof meta.displayName === 'string' && meta.displayName.trim() ? meta.displayName.trim() : '';
      /** Keep rows even if the catalog template was removed — otherwise the vendor portal looks “empty”. */
      const catalogName = item?.name || metaDisplay || 'Catalog service (removed or unavailable)';
      let categoryName: string | null = null;
      let categoryId: string | null = null;
      if (item?.serviceCategoryId) {
        categoryId = item.serviceCategoryId;
        const cat = await scRepo.findOne({ where: { id: item.serviceCategoryId } });
        categoryName = cat?.name ?? null;
      }
      out.push({
        id: link.id,
        vendorId: link.vendorId,
        serviceId: link.serviceId,
        price: String(link.price),
        isAvailable: Boolean(link.isAvailable),
        isActive: Boolean(link.isActive),
        moderationStatus: link.moderationStatus || 'approved',
        metadata: link.metadata,
        catalogName,
        catalogIconUrl: item?.iconUrl ?? null,
        catalogDescription: item?.description ?? null,
        catalogMetadata: item?.metadata ?? null,
        categoryId,
        categoryName,
      });
    }
    return out;
  }

  buildVendorMetadata(
    body: Partial<{
      displayName: string | null | undefined;
      description: string | null | undefined;
      iconUrl: string | null | undefined;
      trending: boolean | undefined;
      emergency: boolean | undefined;
      basePrice: string | null | undefined;
      priceType: string | null | undefined;
      duration: string | null | undefined;
      city: string | null | undefined;
    }>,
    existing: Record<string, unknown> | null,
  ): Record<string, unknown> {
    const m = existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
    if (body.displayName !== undefined) {
      const t = body.displayName?.trim();
      if (t) m.displayName = t;
      else delete m.displayName;
    }
    if (body.description !== undefined) {
      const t = body.description?.trim();
      if (t) m.vendorDescription = t;
      else delete m.vendorDescription;
    }
    if (body.iconUrl !== undefined) {
      const t = body.iconUrl?.trim();
      if (t) m.vendorIconUrl = t;
      else delete m.vendorIconUrl;
    }
    if (body.trending !== undefined) m.trending = Boolean(body.trending);
    if (body.emergency !== undefined) m.emergency = Boolean(body.emergency);
    if (body.basePrice !== undefined) {
      const t = body.basePrice?.trim();
      if (t) m.referenceBasePrice = t;
      else delete m.referenceBasePrice;
    }
    if (body.priceType !== undefined) {
      const t = (body.priceType || '').trim();
      if (t) m.priceType = t;
      else delete m.priceType;
    }
    if (body.duration !== undefined) {
      const t = body.duration?.trim();
      if (t) m.duration = t;
      else delete m.duration;
    }
    if (body.city !== undefined) {
      const t = body.city?.trim();
      if (t) m.city = t;
      else delete m.city;
    }
    return m;
  }

  async createOffering(
    vendorId: string,
    body: {
      serviceId: string;
      price: string;
      isActive?: boolean;
      isAvailable?: boolean;
      displayName?: string | null;
      description?: string | null;
      iconUrl?: string | null;
      trending?: boolean;
      emergency?: boolean;
      basePrice?: string | null;
      priceType?: string | null;
      duration?: string | null;
      city?: string | null;
    },
  ): Promise<CatalogVendorService> {
    await this.assertServiceVendor(vendorId);
    const n = Number(String(body.price).replace(/,/g, ''));
    if (Number.isNaN(n) || n < 0) throw new Error('Price must be a valid non-negative number');
    const ciRepo = AppDataSource.getRepository(CatalogServiceItem);
    const vsRepo = AppDataSource.getRepository(CatalogVendorService);
    const service = await ciRepo.findOne({ where: { id: body.serviceId } });
    if (!service) throw new Error('Service not found');
    const dup = await vsRepo.findOne({ where: { vendorId, serviceId: body.serviceId } });
    if (dup) throw new Error('You already offer this catalog service — edit the existing listing instead');

    const meta = this.buildVendorMetadata(body, null);
    const row = vsRepo.create({
      vendorId,
      serviceId: body.serviceId,
      price: String(n),
      isAvailable: body.isAvailable ?? true,
      isActive: false,
      moderationStatus: 'pending',
      metadata: Object.keys(meta).length ? meta : null,
    });
    return vsRepo.save(row);
  }

  async updateOffering(
    vendorId: string,
    linkId: string,
    body: Partial<{
      price: string;
      isActive: boolean;
      isAvailable: boolean;
      displayName: string | null;
      description: string | null;
      iconUrl: string | null;
      trending: boolean;
      emergency: boolean;
      basePrice: string | null;
      priceType: string | null;
      duration: string | null;
      city: string | null;
    }>,
  ): Promise<CatalogVendorService> {
    await this.assertServiceVendor(vendorId);
    const vsRepo = AppDataSource.getRepository(CatalogVendorService);
    const row = await vsRepo.findOne({ where: { id: linkId, vendorId } });
    if (!row) throw new Error('Vendor service offer not found');
    if (body.price !== undefined) {
      const n = Number(String(body.price).replace(/,/g, ''));
      if (Number.isNaN(n) || n < 0) throw new Error('Price must be a valid non-negative number');
      row.price = String(n);
    }
    const pending = row.moderationStatus === 'pending';
    if (body.isActive !== undefined && !pending) row.isActive = body.isActive;
    if (body.isAvailable !== undefined) row.isAvailable = body.isAvailable;
    const merged = this.buildVendorMetadata(body, row.metadata);
    row.metadata = Object.keys(merged).length ? merged : null;
    return vsRepo.save(row);
  }

  async deleteOffering(vendorId: string, linkId: string): Promise<void> {
    await this.assertServiceVendor(vendorId);
    const vsRepo = AppDataSource.getRepository(CatalogVendorService);
    const row = await vsRepo.findOne({ where: { id: linkId, vendorId } });
    if (!row) throw new Error('Vendor service offer not found');
    await vsRepo.remove(row);
  }
}
