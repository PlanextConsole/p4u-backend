import { In } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { PlatformConfigAdminService } from '../platform-config/platform-config.service';
import { Customer } from './entities/Customer';
import { CustomerReferral } from './entities/CustomerReferral';
import { Coupon } from './entities/Coupon';
import { Occupation } from './entities/Occupation';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateOccupationDto } from './dto/create-occupation.dto';
import { UpdateOccupationDto } from './dto/update-occupation.dto';

export type CustomerReferralReportRow = {
  id: string;
  createdAt: Date;
  referralCode: string;
  status: string;
  rewardPointsEarned: number;
  referrerCustomerId: string;
  referredCustomerId: string;
  referrerName: string;
  referrerDisplayId: string;
  referredName: string;
  referredEmail: string;
  referredPhone: string;
  referredCustomerDisplayId: string;
  ownCode: string;
  walletPoints: number;
  referredStatus: string;
  referredJoinedAt: Date | null;
};

export class CustomerAdminService {
  private audit = new AuditService();
  private platformConfig = new PlatformConfigAdminService();

  async listCustomers(limit: number, offset: number): Promise<{ items: Customer[]; total: number }> {
    const repo = AppDataSource.getRepository(Customer);
    const [items, total] = await repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async updateCustomer(
    id: string,
    dto: UpdateCustomerDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<Customer> {
    const repo = AppDataSource.getRepository(Customer);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Customer not found');
    if (dto.fullName !== undefined) row.fullName = dto.fullName;
    if (dto.email !== undefined) row.email = dto.email;
    if (dto.phone !== undefined) row.phone = dto.phone;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.occupationId !== undefined) row.occupationId = dto.occupationId;
    if (dto.keycloakUserId !== undefined) row.keycloakUserId = dto.keycloakUserId;
    if (dto.metadata !== undefined) row.metadata = dto.metadata;
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'Customer',
      entityId: row.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async deleteCustomer(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(Customer);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Customer not found');
    await repo.remove(row);
    await this.audit.log({
      actorSub,
      action: 'DELETE',
      entityType: 'Customer',
      entityId: id,
      metadata: { fullName: row.fullName },
      ipAddress: ip ?? null,
    });
  }

  /** Resolve by profile UUID or Keycloak `sub` (matches `commerce_orders.customer_id`). */
  async getCustomer(id: string): Promise<Customer | null> {
    return AppDataSource.getRepository(Customer).findOne({
      where: [{ id }, { keycloakUserId: id }],
    });
  }

  async createCustomer(dto: any, actorSub: string, ip: string | undefined): Promise<Customer> {
    const repo = AppDataSource.getRepository(Customer);
    const row = repo.create({
      fullName: dto.fullName,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      status: dto.status ?? 'active',
      occupationId: dto.occupationId ?? null,
      keycloakUserId: dto.keycloakUserId ?? null,
      metadata: dto.metadata ?? null,
    });
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'Customer',
      entityId: row.id,
      metadata: { fullName: row.fullName },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async listAllCoupons(limit: number, offset: number): Promise<{ items: Coupon[]; total: number }> {
    const repo = AppDataSource.getRepository(Coupon);
    const [items, total] = await repo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async createCoupon(dto: any, actorSub: string, ip: string | undefined): Promise<Coupon> {
    const repo = AppDataSource.getRepository(Coupon);
    const row = repo.create({
      code: dto.code,
      title: dto.title,
      status: dto.status ?? 'active',
      discountJson: dto.discountJson ?? null,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
    });
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'Coupon',
      entityId: row.id,
      metadata: { code: row.code },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async updateCoupon(id: string, dto: any, actorSub: string, ip: string | undefined): Promise<Coupon> {
    const repo = AppDataSource.getRepository(Coupon);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Coupon not found');
    if (dto.code !== undefined) row.code = dto.code;
    if (dto.title !== undefined) row.title = dto.title;
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.discountJson !== undefined) row.discountJson = dto.discountJson;
    if (dto.validFrom !== undefined) row.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validTo !== undefined) row.validTo = dto.validTo ? new Date(dto.validTo) : null;
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'Coupon',
      entityId: row.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async deleteCoupon(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(Coupon);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Coupon not found');
    await repo.remove(row);
    await this.audit.log({
      actorSub,
      action: 'DELETE',
      entityType: 'Coupon',
      entityId: id,
      metadata: { code: row.code },
      ipAddress: ip ?? null,
    });
  }

  async getOccupation(id: string): Promise<Occupation | null> {
    return AppDataSource.getRepository(Occupation).findOne({ where: { id } });
  }

  async deleteOccupation(id: string, actorSub: string, ip: string | undefined): Promise<void> {
    const repo = AppDataSource.getRepository(Occupation);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Occupation not found');
    await repo.remove(row);
    await this.audit.log({
      actorSub,
      action: 'DELETE',
      entityType: 'Occupation',
      entityId: id,
      metadata: { name: row.name },
      ipAddress: ip ?? null,
    });
  }

  async listOccupations(): Promise<Occupation[]> {
    return AppDataSource.getRepository(Occupation).find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async listOccupationsAll(includeInactive: boolean): Promise<Occupation[]> {
    if (includeInactive) {
      return AppDataSource.getRepository(Occupation).find({
        order: { sortOrder: 'ASC', name: 'ASC' },
      });
    }
    return this.listOccupations();
  }

  /** Occupations plus per-row customer counts and total registered customers (for admin Occupations page). */
  async listOccupationsWithCustomerCounts(includeInactive: boolean): Promise<{
    items: Array<Occupation & { customerCount: number }>;
    totalCustomers: number;
  }> {
    const occRepo = AppDataSource.getRepository(Occupation);
    const custRepo = AppDataSource.getRepository(Customer);
    const qb = occRepo.createQueryBuilder('o');
    if (!includeInactive) {
      qb.where('o.isActive = :ia', { ia: true });
    }
    qb.orderBy('o.sort_order', 'ASC').addOrderBy('o.name', 'ASC');
    const items = await qb.getMany();
    const totalCustomers = await custRepo.count();
    if (items.length === 0) {
      return { items: [], totalCustomers };
    }
    const raw = await custRepo
      .createQueryBuilder('c')
      .select('c.occupation_id', 'occupationId')
      .addSelect('COUNT(c.id)', 'cnt')
      .where('c.occupation_id IS NOT NULL')
      .groupBy('c.occupation_id')
      .getRawMany();
    const map = new Map<string, number>();
    for (const r of raw as Record<string, unknown>[]) {
      const k = r.occupationId ?? r.occupation_id;
      const cnt = r.cnt ?? r.COUNT_c_id;
      if (k != null) map.set(String(k), parseInt(String(cnt), 10));
    }
    return {
      items: items.map(o => ({ ...o, customerCount: map.get(o.id) ?? 0 })),
      totalCustomers,
    };
  }

  async getOccupationWithCustomerCount(id: string): Promise<(Occupation & { customerCount: number }) | null> {
    const o = await this.getOccupation(id);
    if (!o) return null;
    const customerCount = await AppDataSource.getRepository(Customer).count({ where: { occupationId: id } });
    return { ...o, customerCount };
  }

  async createOccupation(
    dto: CreateOccupationDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<Occupation> {
    if (!(await this.platformConfig.isOccupationAdminCreateEnabled())) {
      throw new Error('OCCUPATION_CREATE_DISABLED');
    }
    const repo = AppDataSource.getRepository(Occupation);
    const row = repo.create({
      name: dto.name,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    });
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'CREATE',
      entityType: 'Occupation',
      entityId: row.id,
      metadata: { name: row.name },
      ipAddress: ip ?? null,
    });
    return row;
  }

  async updateOccupation(
    id: string,
    dto: UpdateOccupationDto,
    actorSub: string,
    ip: string | undefined
  ): Promise<Occupation> {
    const repo = AppDataSource.getRepository(Occupation);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Occupation not found');
    if (dto.name !== undefined) row.name = dto.name;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    await repo.save(row);
    await this.audit.log({
      actorSub,
      action: 'UPDATE',
      entityType: 'Occupation',
      entityId: row.id,
      metadata: { changes: dto },
      ipAddress: ip ?? null,
    });
    return row;
  }

  /** All rows from `customer_referrals` with referred (and referrer) customer fields for admin reporting. */
  async listCustomerReferralsReport(
    limit: number,
    offset: number
  ): Promise<{ items: CustomerReferralReportRow[]; total: number }> {
    const refRepo = AppDataSource.getRepository(CustomerReferral);
    const [refs, total] = await refRepo.findAndCount({
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    if (refs.length === 0) {
      return { items: [], total };
    }
    const custRepo = AppDataSource.getRepository(Customer);
    const ids = [...new Set(refs.flatMap((r) => [r.referrerCustomerId, r.referredCustomerId]))];
    const customers = await custRepo.find({ where: { id: In(ids) } });
    const byId = new Map(customers.map((c) => [c.id, c]));

    const displayId = (cid: string | undefined) => {
      if (!cid) return '—';
      const hex = String(cid).replace(/-/g, '');
      return `CUST-${hex.slice(0, 8).toUpperCase()}`;
    };

    const items: CustomerReferralReportRow[] = refs.map((ref) => {
      const referred = byId.get(ref.referredCustomerId);
      const referrer = byId.get(ref.referrerCustomerId);
      const meta = (referred?.metadata || {}) as Record<string, unknown>;
      const ownCode = String(meta.referralCode || meta.referral_code || '').trim();
      const wallet = Number(meta.wallet ?? meta.walletBalance ?? 0) || 0;
      return {
        id: ref.id,
        createdAt: ref.createdAt,
        referralCode: ref.referralCode,
        status: ref.status,
        rewardPointsEarned: ref.rewardPointsEarned,
        referrerCustomerId: ref.referrerCustomerId,
        referredCustomerId: ref.referredCustomerId,
        referrerName: referrer?.fullName || '—',
        referrerDisplayId: displayId(ref.referrerCustomerId),
        referredName: referred?.fullName || '—',
        referredEmail: referred?.email || '',
        referredPhone: referred?.phone || '',
        referredCustomerDisplayId: displayId(ref.referredCustomerId),
        ownCode: ownCode || '—',
        walletPoints: wallet,
        referredStatus: referred?.status || '—',
        referredJoinedAt: referred?.createdAt ?? null,
      };
    });
    return { items, total };
  }
}
