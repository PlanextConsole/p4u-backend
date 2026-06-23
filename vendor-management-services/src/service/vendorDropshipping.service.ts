import { randomUUID } from 'crypto';
import { AppDataSource } from '../config/database';
import { DropshippingSupplier } from '../entities/DropshippingSupplier';
import { DropshippingOrder } from '../entities/DropshippingOrder';
import { VendorDropshippingSettings } from '../entities/VendorDropshippingSettings';
import { PlatformSettings } from '../entities/PlatformSettings';
import { Order } from '../entities/Order';
import { PutVendorDropshippingSettingsDto } from '../dto/put-vendor-dropshipping-settings.dto';
import { VendorNotificationEmitter } from './vendorNotificationEmitter';

const FORWARDABLE = new Set(['pending']);
const VENDOR_STATUS = new Set(['cancelled']);

function defaultSettings(vendorId: string): VendorDropshippingSettings {
  const repo = AppDataSource.getRepository(VendorDropshippingSettings);
  return repo.create({
    vendorId,
    enabled: false,
    defaultSupplierId: null,
    autoForwardOrders: false,
    defaultMarginPercent: '20',
    notifyOnStatusChange: true,
  });
}

export class VendorDropshippingService {
  private readonly notifier = new VendorNotificationEmitter();

  async isPlatformEnabled(): Promise<boolean> {
    const row = await AppDataSource.getRepository(PlatformSettings).findOne({ where: { id: 1 } });
    if (!row) return process.env.DROPSHIPPING_ENABLED !== 'false';
    return Boolean(row.dropshippingEnabled);
  }

  async getSettingsBundle(vendorId: string) {
    const repo = AppDataSource.getRepository(VendorDropshippingSettings);
    let settings = await repo.findOne({ where: { vendorId } });
    if (!settings) settings = defaultSettings(vendorId);
    const platformEnabled = await this.isPlatformEnabled();
    return {
      platformEnabled,
      settings: {
        vendorId: settings.vendorId,
        enabled: settings.enabled,
        defaultSupplierId: settings.defaultSupplierId,
        autoForwardOrders: settings.autoForwardOrders,
        defaultMarginPercent: Number(settings.defaultMarginPercent || 0),
        notifyOnStatusChange: settings.notifyOnStatusChange,
        updatedAt: settings.updatedAt,
      },
    };
  }

  async saveSettings(vendorId: string, dto: PutVendorDropshippingSettingsDto) {
    const repo = AppDataSource.getRepository(VendorDropshippingSettings);
    let row = await repo.findOne({ where: { vendorId } });
    if (!row) row = defaultSettings(vendorId);

    if (dto.defaultSupplierId) {
      const supplier = await AppDataSource.getRepository(DropshippingSupplier).findOne({
        where: { id: dto.defaultSupplierId, status: 'active' },
      });
      if (!supplier) throw new Error('Default supplier not found or inactive');
      row.defaultSupplierId = dto.defaultSupplierId;
    } else if (dto.defaultSupplierId === null) {
      row.defaultSupplierId = null;
    }

    if (dto.enabled !== undefined) row.enabled = dto.enabled;
    if (dto.autoForwardOrders !== undefined) row.autoForwardOrders = dto.autoForwardOrders;
    if (dto.defaultMarginPercent !== undefined) row.defaultMarginPercent = String(dto.defaultMarginPercent);
    if (dto.notifyOnStatusChange !== undefined) row.notifyOnStatusChange = dto.notifyOnStatusChange;

    const saved = await repo.save(row);
    return this.getSettingsBundle(vendorId);
  }

  async listActiveSuppliers() {
    const items = await AppDataSource.getRepository(DropshippingSupplier).find({
      where: { status: 'active' },
      order: { name: 'ASC' },
    });
    return {
      items: items.map((s) => ({
        id: s.id,
        name: s.name,
        countryCode: s.countryCode,
        currencyCode: s.currencyCode,
        defaultLeadTimeDays: s.defaultLeadTimeDays,
        defaultMarkupPercent: Number(s.defaultMarkupPercent || 0),
      })),
    };
  }

  async listOrders(vendorId: string, limit: number, offset: number) {
    const repo = AppDataSource.getRepository(DropshippingOrder);
    const [items, total] = await repo.findAndCount({
      where: { vendorId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  /** Create a dropshipping order row from a commerce order (if none exists). */
  async ensureDropshipOrderForCommerceOrder(vendorId: string, orderId: string): Promise<DropshippingOrder> {
    const repo = AppDataSource.getRepository(DropshippingOrder);
    const existing = await repo.findOne({ where: { vendorId, orderId } });
    if (existing) return existing;

    const order = await AppDataSource.getRepository(Order).findOne({ where: { id: orderId, vendorId } });
    if (!order) throw new Error('Order not found');

    const settings = await AppDataSource.getRepository(VendorDropshippingSettings).findOne({ where: { vendorId } });
    const supplierId = settings?.defaultSupplierId;
    if (!supplierId) throw new Error('Set a default supplier in dropshipping settings first');

    const meta = (order.metadata && typeof order.metadata === 'object' ? order.metadata : {}) as Record<string, unknown>;
    const lines = Array.isArray(meta.lines) ? meta.lines : Array.isArray(meta.items) ? meta.items : [];
    const total = parseFloat(order.totalAmount || '0') || 0;
    const marginPct = Number(settings?.defaultMarginPercent || 20);
    const marginAmount = (total * marginPct) / 100;
    const costTotal = Math.max(0, total - marginAmount);

    const row = repo.create({
      id: randomUUID(),
      orderId,
      vendorId,
      supplierId,
      items: lines,
      costTotal: costTotal.toFixed(2),
      marginAmount: marginAmount.toFixed(2),
      currencyCode: 'INR',
      status: 'pending',
    });
    return repo.save(row);
  }

  async forwardOrder(vendorId: string, dropshippingOrderId: string) {
    const platformEnabled = await this.isPlatformEnabled();
    if (!platformEnabled) throw new Error('Dropshipping is disabled platform-wide');

    const repo = AppDataSource.getRepository(DropshippingOrder);
    const row = await repo.findOne({ where: { id: dropshippingOrderId, vendorId } });
    if (!row) throw new Error('Dropshipping order not found');
    if (!FORWARDABLE.has(row.status)) throw new Error(`Cannot forward order in status "${row.status}"`);

    row.status = 'submitted';
    row.forwardedAt = new Date();
    row.supplierOrderRef = row.supplierOrderRef || `DS-${row.id.slice(0, 8).toUpperCase()}`;
    const saved = await repo.save(row);

    const settings = await AppDataSource.getRepository(VendorDropshippingSettings).findOne({ where: { vendorId } });
    if (settings?.notifyOnStatusChange) {
      await this.notifier.notifyVendorById(vendorId, {
        type: 'order',
        title: 'Order forwarded to supplier',
        body: `Order ${row.orderId} was sent to your dropship supplier.`,
        deepLink: '/dashboard/product/dropshipping',
      });
    }
    return saved;
  }

  async updateOrderStatus(vendorId: string, dropshippingOrderId: string, status: string) {
    const next = String(status || '').toLowerCase();
    if (!VENDOR_STATUS.has(next)) throw new Error('Vendors may only cancel dropshipping orders from this screen');

    const repo = AppDataSource.getRepository(DropshippingOrder);
    const row = await repo.findOne({ where: { id: dropshippingOrderId, vendorId } });
    if (!row) throw new Error('Dropshipping order not found');
    if (['delivered', 'cancelled', 'failed'].includes(row.status)) {
      throw new Error(`Cannot change status from "${row.status}"`);
    }

    row.status = next;
    return repo.save(row);
  }
}
