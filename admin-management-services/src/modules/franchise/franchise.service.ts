import { EntityManager, In } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { FranchisePlan } from './entities/FranchisePlan';
import { FranchiseRegistration } from './entities/FranchiseRegistration';
import { Franchise } from './entities/Franchise';
import { FranchiseRegistrationPayment } from './entities/FranchiseRegistrationPayment';
import { FranchiseBusinessProjection } from './entities/FranchiseBusinessProjection';

type Filters = Record<string, string | boolean | undefined>;
type Payload = Record<string, any>;

const text = (value: unknown) => String(value ?? '').trim();
const nullableText = (value: unknown) => text(value) || null;
const money = (value: unknown, fallback = '0') => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : fallback;
};
const optionalMoney = (value: unknown) => value === null || value === undefined || value === '' ? null : money(value);
const optionalInt = (value: unknown) => value === null || value === undefined || value === '' ? null : Math.trunc(Number(value));
const bool = (value: unknown, fallback = false) => value === undefined ? fallback : Boolean(value);
const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};

export class FranchiseService {
  private audit = new AuditService();

  private queryPage<T>(qb: any, limit: number, offset: number): Promise<[T[], number]> {
    return qb.take(limit).skip(offset).getManyAndCount();
  }

  private addSearch(qb: any, q: string | undefined, columns: string[]) {
    if (!q?.trim()) return;
    const clauses = columns.map((column) => `LOWER(COALESCE(${column}, '')) LIKE :q`).join(' OR ');
    qb.andWhere(`(${clauses})`, { q: `%${q.trim().toLowerCase()}%` });
  }

  async listPlans(limit: number, offset: number, filters: Filters) {
    const qb = AppDataSource.getRepository(FranchisePlan).createQueryBuilder('plan')
      .orderBy('plan.planType', 'ASC').addOrderBy('plan.tier', 'ASC').addOrderBy('plan.createdAt', 'DESC');
    if (filters.planType) qb.andWhere('plan.planType = :planType', { planType: filters.planType });
    if (!filters.includeInactive) qb.andWhere('plan.isActive = :active', { active: true });
    this.addSearch(qb, filters.q as string, ['plan.planName', 'plan.description']);
    const [items, total] = await this.queryPage<FranchisePlan>(qb, limit, offset);
    return { items, total };
  }

  getPlan(id: string) {
    return AppDataSource.getRepository(FranchisePlan).findOne({ where: { id } });
  }

  private assignPlan(row: FranchisePlan, data: Payload, creating = false) {
    if (creating || data.planName !== undefined) row.planName = text(data.planName);
    if (!row.planName) throw new Error('Plan name is required');
    if (creating || data.description !== undefined) row.description = nullableText(data.description);
    if (creating || data.planType !== undefined) row.planType = data.planType === 'vip' ? 'vip' : 'local';
    if (creating || data.tier !== undefined) row.tier = Math.max(1, Number(data.tier) || 1);
    if (creating || data.price !== undefined) row.price = money(data.price);
    if (creating || data.validityDays !== undefined) row.validityDays = Math.max(1, Number(data.validityDays) || 365);
    if (creating || data.visibilityType !== undefined) {
      row.visibilityType = ['city', 'state', 'country'].includes(data.visibilityType) ? data.visibilityType : 'radius';
    }
    if (creating || data.radiusKm !== undefined || data.visibilityType !== undefined) row.radiusKm = row.visibilityType === 'radius' ? money(data.radiusKm || 0) : null;
    if (creating || data.royaltyPercent !== undefined) row.royaltyPercent = money(data.royaltyPercent);
    if (creating || data.maxUserRedemptionPercent !== undefined) row.maxUserRedemptionPercent = money(data.maxUserRedemptionPercent);
    if (creating || data.paymentMode !== undefined) row.paymentMode = ['online', 'offline'].includes(data.paymentMode) ? data.paymentMode : 'both';
    if (creating || data.promoBannerAds !== undefined) row.promoBannerAds = bool(data.promoBannerAds);
    if (creating || data.promoVideoAds !== undefined) row.promoVideoAds = bool(data.promoVideoAds);
    if (creating || data.promoPriorityListing !== undefined) row.promoPriorityListing = bool(data.promoPriorityListing);
    if (creating || data.territoryExclusive !== undefined) row.territoryExclusive = bool(data.territoryExclusive, true);
    if (creating || data.trainingIncluded !== undefined) row.trainingIncluded = bool(data.trainingIncluded);
    if (creating || data.supportLevel !== undefined) row.supportLevel = ['basic', 'premium', 'enterprise'].includes(data.supportLevel) ? data.supportLevel : null;
    if (creating || data.isActive !== undefined) row.isActive = bool(data.isActive, true);
    if (creating || data.metadata !== undefined) row.metadata = data.metadata ?? null;
  }

  async createPlan(data: Payload, actorSub: string, ip?: string) {
    const repo = AppDataSource.getRepository(FranchisePlan);
    const row = repo.create();
    this.assignPlan(row, data, true);
    const saved = await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'FranchisePlan', entityId: saved.id, metadata: { planName: saved.planName }, ipAddress: ip ?? null });
    return saved;
  }

  async updatePlan(id: string, data: Payload, actorSub: string, ip?: string) {
    const repo = AppDataSource.getRepository(FranchisePlan);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Franchise plan not found');
    this.assignPlan(row, data);
    const saved = await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'FranchisePlan', entityId: id, metadata: { changes: data }, ipAddress: ip ?? null });
    return saved;
  }

  async deletePlan(id: string, actorSub: string, ip?: string) {
    const repo = AppDataSource.getRepository(FranchisePlan);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Franchise plan not found');
    const registrations = await AppDataSource.getRepository(FranchiseRegistration).count({ where: { planId: id } });
    if (registrations) throw new Error('Cannot delete a plan used by registrations');
    await repo.remove(row);
    await this.audit.log({ actorSub, action: 'DELETE', entityType: 'FranchisePlan', entityId: id, ipAddress: ip ?? null });
  }

  private async planMap(ids: Array<string | null>, manager = AppDataSource.manager) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    const plans = unique.length ? await manager.getRepository(FranchisePlan).find({ where: { id: In(unique) } }) : [];
    return new Map(plans.map((plan) => [plan.id, plan]));
  }

  private async paymentTotals(registrationIds: string[], manager = AppDataSource.manager) {
    if (!registrationIds.length) return new Map<string, number>();
    const rows = await manager.getRepository(FranchiseRegistrationPayment).createQueryBuilder('payment')
      .select('payment.registrationId', 'registrationId')
      .addSelect('SUM(payment.amount)', 'total')
      .where('payment.registrationId IN (:...registrationIds)', { registrationIds })
      .andWhere('payment.paymentStatus = :success', { success: 'success' })
      .groupBy('payment.registrationId').getRawMany<{ registrationId: string; total: string }>();
    return new Map(rows.map((row) => [row.registrationId, Number(row.total) || 0]));
  }

  async listRegistrations(limit: number, offset: number, filters: Filters) {
    const qb = AppDataSource.getRepository(FranchiseRegistration).createQueryBuilder('registration').orderBy('registration.createdAt', 'DESC');
    if (filters.status && filters.status !== 'all') qb.andWhere('registration.status = :status', { status: filters.status });
    if (filters.planId) qb.andWhere('registration.planId = :planId', { planId: filters.planId });
    for (const key of ['state', 'city'] as const) if (filters[key]) qb.andWhere(`LOWER(registration.${key}) LIKE :${key}`, { [key]: `%${String(filters[key]).toLowerCase()}%` });
    this.addSearch(qb, filters.q as string, ['registration.applicantName', 'registration.businessName', 'registration.email', 'registration.phone', 'registration.preferredTerritory']);
    const [rows, total] = await this.queryPage<FranchiseRegistration>(qb, limit, offset);
    const plans = await this.planMap(rows.map((row) => row.planId));
    const totals = await this.paymentTotals(rows.map((row) => row.id));
    return { items: rows.map((row) => ({ ...row, planName: row.planId ? plans.get(row.planId)?.planName ?? null : null, planAmount: row.planId ? plans.get(row.planId)?.price ?? '0' : '0', totalPaid: totals.get(row.id) ?? 0 })), total };
  }

  async getRegistration(id: string) {
    const row = await AppDataSource.getRepository(FranchiseRegistration).findOne({ where: { id } });
    if (!row) return null;
    const plans = await this.planMap([row.planId]);
    const totals = await this.paymentTotals([row.id]);
    return { ...row, planName: row.planId ? plans.get(row.planId)?.planName ?? null : null, planAmount: row.planId ? plans.get(row.planId)?.price ?? '0' : '0', totalPaid: totals.get(row.id) ?? 0 };
  }

  private assignRegistration(row: FranchiseRegistration, data: Payload, creating = false) {
    if (creating || data.applicantName !== undefined) row.applicantName = text(data.applicantName);
    if (!row.applicantName) throw new Error('Applicant name is required');
    for (const key of ['businessName', 'email', 'phone', 'city', 'state', 'pincode', 'address', 'preferredTerritory', 'adminNotes', 'rejectionReason'] as const) {
      if (creating || data[key] !== undefined) row[key] = nullableText(data[key]) as never;
    }
    if (creating || data.planId !== undefined) row.planId = nullableText(data.planId);
    if (creating || data.investmentBudget !== undefined) row.investmentBudget = optionalMoney(data.investmentBudget);
    if (creating || data.experienceYears !== undefined) row.experienceYears = optionalInt(data.experienceYears);
    if (creating || data.documentsJson !== undefined) row.documentsJson = data.documentsJson ?? null;
    if (creating || data.metadata !== undefined) row.metadata = data.metadata ?? null;
    if (creating || data.status !== undefined) row.status = ['under_review', 'approved', 'rejected', 'payment_pending', 'active'].includes(data.status) ? data.status : 'pending';
  }

  async createRegistration(data: Payload, actorSub: string, ip?: string) {
    if (data.planId && !(await this.getPlan(data.planId))) throw new Error('Selected franchise plan not found');
    const repo = AppDataSource.getRepository(FranchiseRegistration);
    const row = repo.create();
    this.assignRegistration(row, data, true);
    const saved = await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'FranchiseRegistration', entityId: saved.id, ipAddress: ip ?? null });
    return saved;
  }

  async updateRegistration(id: string, data: Payload, actorSub: string, ip?: string) {
    const repo = AppDataSource.getRepository(FranchiseRegistration);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Franchise registration not found');
    if (data.planId && !(await this.getPlan(data.planId))) throw new Error('Selected franchise plan not found');
    this.assignRegistration(row, data);
    const saved = await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'FranchiseRegistration', entityId: id, metadata: { changes: data }, ipAddress: ip ?? null });
    return saved;
  }

  private async activateIfPaid(manager: EntityManager, registration: FranchiseRegistration, actorSub: string) {
    if (!registration.planId) throw new Error('Select a plan before approval');
    const plan = await manager.getRepository(FranchisePlan).findOne({ where: { id: registration.planId } });
    if (!plan) throw new Error('Selected franchise plan not found');
    const totals = await this.paymentTotals([registration.id], manager);
    const paid = totals.get(registration.id) ?? 0;
    if (paid + 0.001 < Number(plan.price)) return null;

    const repo = manager.getRepository(Franchise);
    let franchise = await repo.findOne({ where: { registrationId: registration.id } });
    if (!franchise) {
      const now = new Date();
      const territory = text(registration.preferredTerritory || registration.city || 'P4U').replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
      franchise = repo.create({
        registrationId: registration.id,
        planId: plan.id,
        franchiseCode: `FR-${territory}-${registration.id.replace(/-/g, '').slice(0, 6).toUpperCase()}`,
        businessName: registration.businessName,
        ownerName: registration.applicantName,
        email: registration.email,
        phone: registration.phone,
        city: registration.city,
        state: registration.state,
        pincode: registration.pincode,
        address: registration.address,
        territoryDescription: registration.preferredTerritory,
        hierarchyNodeId: null,
        status: 'active',
        planStartDate: now.toISOString().slice(0, 10),
        planEndDate: addDays(now, plan.validityDays),
        paymentStatus: 'paid',
        paymentTransactionId: null,
        royaltyPercent: plan.royaltyPercent,
        isActive: true,
        metadata: { activatedBy: actorSub },
      });
      franchise = await repo.save(franchise);
    }
    registration.status = 'approved';
    registration.reviewedAt = new Date();
    registration.reviewedBy = actorSub;
    await manager.getRepository(FranchiseRegistration).save(registration);
    await manager.getRepository(FranchiseRegistrationPayment).createQueryBuilder().update()
      .set({ franchiseId: franchise.id }).where('registration_id = :registrationId', { registrationId: registration.id }).execute();
    return franchise;
  }

  async approveRegistration(id: string, actorSub: string, ip?: string) {
    const result = await AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(FranchiseRegistration);
      const registration = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!registration) throw new Error('Franchise registration not found');
      if (!registration.planId) throw new Error('Select a plan before approval');
      const franchise = await this.activateIfPaid(manager, registration, actorSub);
      if (franchise) return { registration, franchise, paymentRequired: false };
      const plan = await manager.getRepository(FranchisePlan).findOne({ where: { id: registration.planId } });
      if (!plan) throw new Error('Selected franchise plan not found');
      const totals = await this.paymentTotals([registration.id], manager);
      const remaining = Math.max(0, Number(plan.price) - (totals.get(registration.id) ?? 0));
      const pendingRepo = manager.getRepository(FranchiseRegistrationPayment);
      const existingPending = await pendingRepo.findOne({ where: { registrationId: id, paymentStatus: 'pending' } });
      if (!existingPending) {
        await pendingRepo.save(pendingRepo.create({ registrationId: id, franchiseId: null, planId: plan.id, amount: remaining.toFixed(2), currency: 'INR', paymentMode: plan.paymentMode === 'online' ? 'online' : 'offline', paymentStatus: 'pending', recordedBy: actorSub, paidAt: null, transactionId: null, gatewayReference: null, notes: 'Outstanding balance created during registration approval', metadata: null }));
      }
      registration.status = 'payment_pending';
      registration.reviewedAt = new Date();
      registration.reviewedBy = actorSub;
      await repo.save(registration);
      return { registration, franchise: null, paymentRequired: true };
    });
    await this.audit.log({ actorSub, action: 'APPROVE', entityType: 'FranchiseRegistration', entityId: id, metadata: { paymentRequired: result.paymentRequired }, ipAddress: ip ?? null });
    return result;
  }

  async rejectRegistration(id: string, reason: string, actorSub: string, ip?: string) {
    if (!text(reason)) throw new Error('Rejection reason is required');
    const repo = AppDataSource.getRepository(FranchiseRegistration);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Franchise registration not found');
    row.status = 'rejected'; row.rejectionReason = text(reason); row.reviewedAt = new Date(); row.reviewedBy = actorSub;
    await repo.save(row);
    await this.audit.log({ actorSub, action: 'REJECT', entityType: 'FranchiseRegistration', entityId: id, metadata: { reason: row.rejectionReason }, ipAddress: ip ?? null });
    return row;
  }

  async deleteRegistration(id: string, actorSub: string, ip?: string) {
    const repo = AppDataSource.getRepository(FranchiseRegistration);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Franchise registration not found');
    if (await AppDataSource.getRepository(Franchise).count({ where: { registrationId: id } })) throw new Error('Cannot delete an activated registration');
    await repo.remove(row);
    await this.audit.log({ actorSub, action: 'DELETE', entityType: 'FranchiseRegistration', entityId: id, ipAddress: ip ?? null });
  }

  async listActive(limit: number, offset: number, filters: Filters) {
    const qb = AppDataSource.getRepository(Franchise).createQueryBuilder('franchise').orderBy('franchise.createdAt', 'DESC');
    if (filters.status && filters.status !== 'all') qb.andWhere('franchise.status = :status', { status: filters.status });
    if (filters.planId) qb.andWhere('franchise.planId = :planId', { planId: filters.planId });
    if (filters.paymentStatus) qb.andWhere('franchise.paymentStatus = :paymentStatus', { paymentStatus: filters.paymentStatus });
    for (const key of ['state', 'city'] as const) if (filters[key]) qb.andWhere(`LOWER(franchise.${key}) LIKE :${key}`, { [key]: `%${String(filters[key]).toLowerCase()}%` });
    this.addSearch(qb, filters.q as string, ['franchise.franchiseCode', 'franchise.businessName', 'franchise.ownerName', 'franchise.email', 'franchise.phone', 'franchise.territoryDescription']);
    const [rows, total] = await this.queryPage<Franchise>(qb, limit, offset);
    const plans = await this.planMap(rows.map((row) => row.planId));
    return { items: rows.map((row) => ({ ...row, planName: plans.get(row.planId)?.planName ?? null })), total };
  }

  async getActive(id: string) {
    const row = await AppDataSource.getRepository(Franchise).findOne({ where: { id } });
    if (!row) return null;
    const plans = await this.planMap([row.planId]);
    return { ...row, planName: plans.get(row.planId)?.planName ?? null };
  }

  async updateActive(id: string, data: Payload, actorSub: string, ip?: string) {
    const repo = AppDataSource.getRepository(Franchise);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Franchise not found');
    for (const key of ['businessName', 'ownerName', 'email', 'phone', 'city', 'state', 'pincode', 'address', 'territoryDescription', 'hierarchyNodeId', 'paymentTransactionId'] as const) if (data[key] !== undefined) row[key] = nullableText(data[key]) as never;
    if (data.ownerName !== undefined && !row.ownerName) throw new Error('Owner name is required');
    if (data.planStartDate !== undefined) row.planStartDate = text(data.planStartDate);
    if (data.planEndDate !== undefined) row.planEndDate = text(data.planEndDate);
    if (data.paymentStatus !== undefined && ['paid', 'unpaid', 'pending', 'refunded'].includes(data.paymentStatus)) row.paymentStatus = data.paymentStatus;
    if (data.royaltyPercent !== undefined) row.royaltyPercent = money(data.royaltyPercent);
    if (data.metadata !== undefined) row.metadata = data.metadata ?? null;
    const saved = await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'Franchise', entityId: id, metadata: { changes: data }, ipAddress: ip ?? null });
    return saved;
  }

  async setActiveStatus(id: string, status: 'suspended' | 'terminated', actorSub: string, ip?: string) {
    const repo = AppDataSource.getRepository(Franchise);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Franchise not found');
    row.status = status; row.isActive = false;
    const saved = await repo.save(row);
    await this.audit.log({ actorSub, action: status === 'suspended' ? 'SUSPEND' : 'TERMINATE', entityType: 'Franchise', entityId: id, ipAddress: ip ?? null });
    return saved;
  }

  async listPayments(limit: number, offset: number, filters: Filters) {
    const qb = AppDataSource.getRepository(FranchiseRegistrationPayment).createQueryBuilder('payment')
      .leftJoin(FranchiseRegistration, 'registration', 'registration.id = payment.registrationId')
      .orderBy('payment.createdAt', 'DESC');
    if (filters.status && filters.status !== 'all') qb.andWhere('payment.paymentStatus = :status', { status: filters.status });
    if (filters.dateFrom) qb.andWhere('payment.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    if (filters.dateTo) qb.andWhere('payment.createdAt < :dateTo', { dateTo: new Date(new Date(String(filters.dateTo)).getTime() + 86400000) });
    this.addSearch(qb, filters.q as string, ['payment.transactionId', 'payment.gatewayReference', 'payment.registrationId', 'registration.applicantName', 'registration.businessName', 'registration.email', 'registration.phone']);
    const [rows, total] = await this.queryPage<FranchiseRegistrationPayment>(qb, limit, offset);
    const registrations = rows.length ? await AppDataSource.getRepository(FranchiseRegistration).find({ where: { id: In([...new Set(rows.map((row) => row.registrationId))]) } }) : [];
    const registrationMap = new Map(registrations.map((row) => [row.id, row]));
    const plans = await this.planMap(rows.map((row) => row.planId));
    return { items: rows.map((row) => ({ ...row, applicantName: registrationMap.get(row.registrationId)?.applicantName ?? null, businessName: registrationMap.get(row.registrationId)?.businessName ?? null, planName: plans.get(row.planId)?.planName ?? null })), total };
  }

  getPayment(id: string) {
    return AppDataSource.getRepository(FranchiseRegistrationPayment).findOne({ where: { id } });
  }

  async createPayment(data: Payload, actorSub: string, ip?: string) {
    const result = await AppDataSource.transaction(async (manager) => {
      const registration = await manager.getRepository(FranchiseRegistration).findOne({ where: { id: text(data.registrationId) }, lock: { mode: 'pessimistic_write' } });
      if (!registration) throw new Error('Franchise registration not found');
      if (!registration.planId) throw new Error('Registration has no selected plan');
      const repo = manager.getRepository(FranchiseRegistrationPayment);
      const status = ['success', 'failed', 'refunded'].includes(data.paymentStatus) ? data.paymentStatus : 'pending';
      const row = await repo.save(repo.create({
        registrationId: registration.id, franchiseId: null, planId: registration.planId,
        amount: money(data.amount), currency: text(data.currency) || 'INR',
        paymentMode: ['online', 'bank_transfer'].includes(data.paymentMode) ? data.paymentMode : 'offline',
        paymentStatus: status, transactionId: nullableText(data.transactionId), gatewayReference: nullableText(data.gatewayReference),
        paidAt: status === 'success' ? data.paidAt ? new Date(data.paidAt) : new Date() : null,
        recordedBy: actorSub, notes: nullableText(data.notes), metadata: data.metadata ?? null,
      }));
      const franchise = status === 'success' ? await this.activateIfPaid(manager, registration, actorSub) : null;
      return { payment: row, franchise };
    });
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'FranchiseRegistrationPayment', entityId: result.payment.id, ipAddress: ip ?? null });
    return result;
  }

  async updatePayment(id: string, data: Payload, actorSub: string, ip?: string) {
    const result = await AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(FranchiseRegistrationPayment);
      const row = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!row) throw new Error('Franchise payment not found');
      if (data.amount !== undefined) row.amount = money(data.amount);
      if (data.paymentMode !== undefined && ['online', 'offline', 'bank_transfer'].includes(data.paymentMode)) row.paymentMode = data.paymentMode;
      if (data.paymentStatus !== undefined && ['pending', 'success', 'failed', 'refunded'].includes(data.paymentStatus)) row.paymentStatus = data.paymentStatus;
      if (data.transactionId !== undefined) row.transactionId = nullableText(data.transactionId);
      if (data.gatewayReference !== undefined) row.gatewayReference = nullableText(data.gatewayReference);
      if (data.notes !== undefined) row.notes = nullableText(data.notes);
      if (row.paymentStatus === 'success' && !row.paidAt) row.paidAt = data.paidAt ? new Date(data.paidAt) : new Date();
      await repo.save(row);
      const registration = await manager.getRepository(FranchiseRegistration).findOne({ where: { id: row.registrationId }, lock: { mode: 'pessimistic_write' } });
      const franchise = row.paymentStatus === 'success' && registration ? await this.activateIfPaid(manager, registration, actorSub) : null;
      if (row.paymentStatus === 'refunded' && row.franchiseId) await manager.getRepository(Franchise).update(row.franchiseId, { paymentStatus: 'refunded' });
      return { payment: row, franchise };
    });
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'FranchiseRegistrationPayment', entityId: id, metadata: { changes: data }, ipAddress: ip ?? null });
    return result;
  }

  async listProjections(limit: number, offset: number, filters: Filters) {
    const qb = AppDataSource.getRepository(FranchiseBusinessProjection).createQueryBuilder('projection').orderBy('projection.createdAt', 'DESC');
    if (filters.status && filters.status !== 'all') qb.andWhere('projection.status = :status', { status: filters.status });
    this.addSearch(qb, filters.q as string, ['projection.territoryName', 'projection.city', 'projection.state', 'projection.preparedBy', 'projection.marketNotes']);
    const [rows, total] = await this.queryPage<FranchiseBusinessProjection>(qb, limit, offset);
    const plans = await this.planMap(rows.map((row) => row.planId));
    return { items: rows.map((row) => ({ ...row, planName: row.planId ? plans.get(row.planId)?.planName ?? null : null })), total };
  }

  getProjection(id: string) {
    return AppDataSource.getRepository(FranchiseBusinessProjection).findOne({ where: { id } });
  }

  private assignProjection(row: FranchiseBusinessProjection, data: Payload, actorSub: string, creating = false) {
    if (creating || data.territoryName !== undefined) row.territoryName = text(data.territoryName);
    if (!row.territoryName) throw new Error('Territory name is required');
    for (const key of ['registrationId', 'franchiseId', 'planId', 'city', 'state', 'marketNotes'] as const) if (creating || data[key] !== undefined) row[key] = nullableText(data[key]) as never;
    for (const key of ['initialInvestment', 'franchiseFee', 'projectedMonthlyRevenue', 'projectedAnnualRevenue'] as const) if (creating || data[key] !== undefined) row[key] = money(data[key]) as never;
    for (const key of ['setupCost', 'monthlyOpex', 'projectedRoiPercent'] as const) if (creating || data[key] !== undefined) row[key] = optionalMoney(data[key]) as never;
    for (const key of ['projectedBreakEvenMonths', 'populationEstimate'] as const) if (creating || data[key] !== undefined) row[key] = optionalInt(data[key]) as never;
    if (creating || data.status !== undefined) row.status = ['submitted', 'approved', 'rejected'].includes(data.status) ? data.status : 'draft';
    if (creating || data.preparedBy !== undefined) row.preparedBy = nullableText(data.preparedBy) || actorSub;
    if (creating || data.metadata !== undefined) row.metadata = data.metadata ?? null;
  }

  async createProjection(data: Payload, actorSub: string, ip?: string) {
    const repo = AppDataSource.getRepository(FranchiseBusinessProjection);
    const row = repo.create(); this.assignProjection(row, data, actorSub, true);
    const saved = await repo.save(row);
    await this.audit.log({ actorSub, action: 'CREATE', entityType: 'FranchiseBusinessProjection', entityId: saved.id, ipAddress: ip ?? null });
    return saved;
  }

  async updateProjection(id: string, data: Payload, actorSub: string, ip?: string) {
    const repo = AppDataSource.getRepository(FranchiseBusinessProjection);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Franchise projection not found');
    this.assignProjection(row, data, actorSub);
    const saved = await repo.save(row);
    await this.audit.log({ actorSub, action: 'UPDATE', entityType: 'FranchiseBusinessProjection', entityId: id, metadata: { changes: data }, ipAddress: ip ?? null });
    return saved;
  }

  async deleteProjection(id: string, actorSub: string, ip?: string) {
    const repo = AppDataSource.getRepository(FranchiseBusinessProjection);
    const row = await repo.findOne({ where: { id } });
    if (!row) throw new Error('Franchise projection not found');
    await repo.remove(row);
    await this.audit.log({ actorSub, action: 'DELETE', entityType: 'FranchiseBusinessProjection', entityId: id, ipAddress: ip ?? null });
  }
}
