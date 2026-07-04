import { Repository } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { FoodRestaurant } from './entities/FoodRestaurant';
import { FoodRider } from './entities/FoodRider';
import { FoodOrder } from './entities/FoodOrder';
import { FoodCoupon } from './entities/FoodCoupon';
import { FoodRiderSettlement } from './entities/FoodRiderSettlement';

type Kind = 'restaurants' | 'riders' | 'orders' | 'coupons' | 'settlements';
type Filters = { q?: string; status?: string; limit: number; offset: number; includeInactive?: boolean };

export class FoodService {
  private audit = new AuditService();
  private schemaReady = false;

  private repo(kind: Kind): Repository<any> {
    if (kind === 'restaurants') return AppDataSource.getRepository(FoodRestaurant);
    if (kind === 'riders') return AppDataSource.getRepository(FoodRider);
    if (kind === 'orders') return AppDataSource.getRepository(FoodOrder);
    if (kind === 'coupons') return AppDataSource.getRepository(FoodCoupon);
    return AppDataSource.getRepository(FoodRiderSettlement);
  }

  async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS food_restaurants (id varchar(36) NOT NULL PRIMARY KEY,title varchar(160) NOT NULL,tagline varchar(180) NULL,description text NULL,cuisines json NULL,address varchar(255) NOT NULL,latitude decimal(10,7) NULL,longitude decimal(10,7) NULL,phone varchar(30) NULL,vendor_id varchar(80) NULL,cover_image_url varchar(500) NULL,banner_url varchar(500) NULL,logo_url varchar(500) NULL,gallery_urls json NULL,fssai_license varchar(120) NULL,opening_time varchar(20) NULL,closing_time varchar(20) NULL,avg_prep_min int NOT NULL DEFAULT 20,delivery_radius_km decimal(8,2) NOT NULL DEFAULT 8,packaging_fee decimal(10,2) NOT NULL DEFAULT 15,min_order decimal(10,2) NOT NULL DEFAULT 99,commission_percent decimal(5,2) NOT NULL DEFAULT 20,is_pure_veg tinyint(1) NOT NULL DEFAULT 0,is_active tinyint(1) NOT NULL DEFAULT 1,created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),INDEX IDX_food_restaurants_active (is_active)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS food_riders (id varchar(36) NOT NULL PRIMARY KEY,name varchar(140) NOT NULL,mobile varchar(30) NULL,email varchar(160) NULL,vehicle_type varchar(40) NOT NULL DEFAULT 'Bike',vehicle_no varchar(40) NULL,kyc_status varchar(30) NOT NULL DEFAULT 'pending',is_active tinyint(1) NOT NULL DEFAULT 1,pending_balance decimal(12,2) NOT NULL DEFAULT 0,documents json NULL,created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),INDEX IDX_food_riders_kyc (kyc_status),INDEX IDX_food_riders_active (is_active)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS food_orders (id varchar(36) NOT NULL PRIMARY KEY,order_no varchar(60) NOT NULL,restaurant_id varchar(80) NULL,restaurant_name varchar(160) NULL,customer_name varchar(140) NULL,rider_id varchar(80) NULL,total decimal(12,2) NOT NULL DEFAULT 0,status varchar(40) NOT NULL DEFAULT 'pending',payment_status varchar(40) NOT NULL DEFAULT 'pending',items json NULL,created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),INDEX IDX_food_orders_status (status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS food_coupons (id varchar(36) NOT NULL PRIMARY KEY,code varchar(60) NOT NULL UNIQUE,title varchar(160) NOT NULL,description text NULL,discount_type varchar(30) NOT NULL DEFAULT 'flat',discount_value decimal(10,2) NOT NULL DEFAULT 0,max_discount decimal(10,2) NULL,min_order decimal(10,2) NOT NULL DEFAULT 0,per_customer_limit int NOT NULL DEFAULT 1,total_usage_limit int NULL,platform_wide tinyint(1) NOT NULL DEFAULT 1,starts_at datetime NULL,expires_at datetime NULL,is_active tinyint(1) NOT NULL DEFAULT 1,created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),INDEX IDX_food_coupons_active (is_active)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await AppDataSource.query(`CREATE TABLE IF NOT EXISTS food_rider_settlements (id varchar(36) NOT NULL PRIMARY KEY,rider_id varchar(80) NOT NULL,rider_name varchar(140) NOT NULL,amount decimal(12,2) NOT NULL DEFAULT 0,status varchar(40) NOT NULL DEFAULT 'pending',paid_at datetime NULL,created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),INDEX IDX_food_rider_settlements_status (status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    this.schemaReady = true;
  }

  async list(kind: Kind, filters: Filters): Promise<{ items: any[]; total: number }> {
    await this.ensureSchema();
    const qb = this.repo(kind).createQueryBuilder('x').take(filters.limit).skip(filters.offset);
    if (!filters.includeInactive && (kind === 'restaurants' || kind === 'riders' || kind === 'coupons')) qb.andWhere('x.isActive = :active', { active: true });
    if (filters.status) {
      if (kind === 'riders') qb.andWhere('x.kycStatus = :status', { status: filters.status });
      else qb.andWhere('x.status = :status', { status: filters.status });
    }
    if (filters.q?.trim()) {
      const q = `%${filters.q.trim()}%`;
      if (kind === 'restaurants') qb.andWhere('(x.title LIKE :q OR x.address LIKE :q OR x.phone LIKE :q)', { q });
      else if (kind === 'riders') qb.andWhere('(x.name LIKE :q OR x.mobile LIKE :q OR x.email LIKE :q OR x.vehicleNo LIKE :q)', { q });
      else if (kind === 'coupons') qb.andWhere('(x.code LIKE :q OR x.title LIKE :q)', { q });
      else if (kind === 'orders') qb.andWhere('(x.orderNo LIKE :q OR x.restaurantName LIKE :q OR x.customerName LIKE :q)', { q });
      else qb.andWhere('(x.riderName LIKE :q OR x.riderId LIKE :q)', { q });
    }
    qb.orderBy('x.createdAt', 'DESC');
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async create(kind: Kind, body: any, actorSub: string, ip?: string): Promise<any> {
    await this.ensureSchema();
    const repo = this.repo(kind);
    const row = repo.create(this.normalize(kind, body));
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: `Food:${kind}`, entityId: row.id, metadata: body, ipAddress: ip ?? null });
    return row;
  }

  async update(kind: Kind, id: string, body: any, actorSub: string, ip?: string): Promise<any> {
    await this.ensureSchema();
    const repo = this.repo(kind);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Food record not found');
    Object.assign(row, this.normalize(kind, body));
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: `Food:${kind}`, entityId: id, metadata: body, ipAddress: ip ?? null });
    return row;
  }

  async remove(kind: Kind, id: string, actorSub: string, ip?: string): Promise<void> {
    await this.ensureSchema();
    const repo = this.repo(kind);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Food record not found');
    await repo.remove(row);
    await this.audit.log({ actorSub, action: 'DELETE', entityType: `Food:${kind}`, entityId: id, metadata: null, ipAddress: ip ?? null });
  }

  async updateRiderKyc(id: string, status: string, actorSub: string, ip?: string): Promise<FoodRider> {
    return this.update('riders', id, { kycStatus: status }, actorSub, ip);
  }

  async payRiderSettlement(id: string, actorSub: string, ip?: string): Promise<FoodRiderSettlement> {
    return this.update('settlements', id, { status: 'paid', paidAt: new Date() }, actorSub, ip);
  }

  private splitList(value: any): string[] | null {
    if (Array.isArray(value)) return value;
    if (!value) return null;
    return String(value).split(',').map((x) => x.trim()).filter(Boolean);
  }

  private normalize(kind: Kind, body: any): any {
    if (kind === 'restaurants') return { title: String(body.title || body.name || '').trim(), tagline: body.tagline || null, description: body.description || null, cuisines: this.splitList(body.cuisines), address: String(body.address || '').trim(), latitude: body.latitude || null, longitude: body.longitude || null, phone: body.phone || null, vendorId: body.vendorId || null, coverImageUrl: body.coverImageUrl || null, bannerUrl: body.bannerUrl || null, logoUrl: body.logoUrl || null, galleryUrls: this.splitList(body.galleryUrls), fssaiLicense: body.fssaiLicense || null, openingTime: body.openingTime || null, closingTime: body.closingTime || null, avgPrepMin: Number(body.avgPrepMin ?? 20), deliveryRadiusKm: String(body.deliveryRadiusKm ?? 8), packagingFee: String(body.packagingFee ?? 15), minOrder: String(body.minOrder ?? 99), commissionPercent: String(body.commissionPercent ?? 20), isPureVeg: !!body.isPureVeg, isActive: body.isActive !== false };
    if (kind === 'riders') return { name: String(body.name || '').trim(), mobile: body.mobile || null, email: body.email || null, vehicleType: body.vehicleType || 'Bike', vehicleNo: body.vehicleNo || null, kycStatus: body.kycStatus || 'pending', isActive: body.isActive !== false, pendingBalance: String(body.pendingBalance ?? 0), documents: body.documents ?? null };
    if (kind === 'coupons') return { code: String(body.code || '').trim().toUpperCase(), title: String(body.title || '').trim(), description: body.description || null, discountType: body.discountType || 'flat', discountValue: String(body.discountValue ?? 0), maxDiscount: body.maxDiscount || null, minOrder: String(body.minOrder ?? 0), perCustomerLimit: Number(body.perCustomerLimit ?? 1), totalUsageLimit: body.totalUsageLimit ? Number(body.totalUsageLimit) : null, platformWide: body.platformWide !== false, startsAt: body.startsAt ? new Date(body.startsAt) : null, expiresAt: body.expiresAt ? new Date(body.expiresAt) : null, isActive: body.isActive !== false };
    if (kind === 'orders') return { orderNo: body.orderNo || `FOOD-${Date.now()}`, restaurantId: body.restaurantId || null, restaurantName: body.restaurantName || null, customerName: body.customerName || null, riderId: body.riderId || null, total: String(body.total ?? 0), status: body.status || 'pending', paymentStatus: body.paymentStatus || 'pending', items: body.items ?? null };
    return { riderId: body.riderId || '', riderName: body.riderName || '', amount: String(body.amount ?? 0), status: body.status || 'pending', paidAt: body.paidAt ? new Date(body.paidAt) : null };
  }
}