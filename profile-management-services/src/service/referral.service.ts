import { AppDataSource } from '../config/database';
import { Referral } from '../entities/Referral';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';
import { Customer } from '../entities/Customer';
import { CommerceSettlement } from '../entities/CommerceSettlement';
import { getPlatformVarNumber, PLATFORM_VAR_KEYS } from './platformVariable.reader';
import { getSpendablePointsBalance, rewardExpiresAt } from './rewardBalance';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'P4U-';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function extractAppliedReferralCode(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta || typeof meta !== 'object') return null;
  const raw =
    meta.appliedReferralCode ?? meta.referralCodeUsed ?? meta.usedReferralCode ?? '';
  const s = String(raw).trim();
  return s || null;
}

export class ReferralService {
  private referralRepo = AppDataSource.getRepository(Referral);
  private ledgerRepo = AppDataSource.getRepository(RewardPointsLedger);
  private customerRepo = AppDataSource.getRepository(Customer);
  private settlementRepo = AppDataSource.getRepository(CommerceSettlement);

  async syncWalletMetadata(customerId: string): Promise<void> {
    const balance = await getSpendablePointsBalance(this.ledgerRepo, customerId);
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) return;
    const meta = { ...(customer.metadata || {}), wallet: balance, walletBalance: balance };
    customer.metadata = meta;
    await this.customerRepo.save(customer);
  }

  private async recordPointsSettlement(amount: number, metadata: Record<string, unknown>): Promise<void> {
    const settlementMetadata = amount > 0
      ? { ...metadata, expiresAt: rewardExpiresAt().toISOString() }
      : metadata;
    await this.settlementRepo.save(
      this.settlementRepo.create({
        settlementType: 'points',
        status: 'posted',
        amount: String(amount),
        metadata: settlementMetadata,
      }),
    );
  }

  /**
   * When a referred customer carries an applied referral code in profile metadata,
   * credit the referrer once and mark the referral as completed.
   */
  async applyReferralForReferredCustomer(referredCustomerId: string): Promise<void> {
    const referred = await this.customerRepo.findOne({ where: { id: referredCustomerId } });
    if (!referred) return;

    const meta = (referred.metadata || {}) as Record<string, unknown>;
    if (meta.referralRewardApplied === true) return;

    const codeUsed = extractAppliedReferralCode(meta);
    if (!codeUsed) return;

    const existingReferral = await this.referralRepo.findOne({ where: { referredCustomerId } });
    if (existingReferral) {
      meta.referralRewardApplied = true;
      referred.metadata = meta;
      await this.customerRepo.save(referred);
      return;
    }

    const codeNorm = codeUsed.trim().toUpperCase();
    const referrers = await this.customerRepo
      .createQueryBuilder('c')
      .where('UPPER(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.metadata, \'$.referralCode\')))) = :code', { code: codeNorm })
      .getMany();

    if (referrers.length !== 1) return;
    const referrer = referrers[0];
    if (referrer.id === referredCustomerId) return;

    const rawBalance = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.points), 0)', 'balance')
      .where('l.customer_id = :customerId', { customerId: referrer.id })
      .getRawOne();
    const currentBalance = Number(rawBalance?.balance || 0);
    const pts = await getPlatformVarNumber(PLATFORM_VAR_KEYS.REFERRAL_BONUS);

    const referralRow = this.referralRepo.create({
      referrerCustomerId: referrer.id,
      referredCustomerId,
      referralCode: codeUsed.trim(),
      status: 'completed',
      rewardPointsEarned: pts,
      metadata: { source: 'profile' },
    });
    await this.referralRepo.save(referralRow);

    await this.ledgerRepo.save(
      this.ledgerRepo.create({
        customerId: referrer.id,
        points: pts,
        balanceAfter: currentBalance + pts,
        type: 'customer_referral',
        referenceId: referredCustomerId,
        description: 'Reward for referring a new customer',
        metadata: { referralCode: codeUsed.trim(), referredCustomerId },
        expiresAt: rewardExpiresAt(),
      }),
    );

    await this.recordPointsSettlement(pts, {
      customerId: referrer.id,
      customerName: referrer.fullName,
      description: 'Reward for referring a new customer',
      reason: 'customer referral reward',
      referralCode: codeUsed.trim(),
      referredCustomerId,
    });

    // Credit the referee with REFERRAL_BONUS (in addition to the welcome bonus).
    const refereePts = await getPlatformVarNumber(PLATFORM_VAR_KEYS.REFERRAL_BONUS);
    if (refereePts > 0) {
      const refereeBalanceRaw = await this.ledgerRepo
        .createQueryBuilder('l')
        .select('COALESCE(SUM(l.points), 0)', 'balance')
        .where('l.customer_id = :customerId', { customerId: referredCustomerId })
        .getRawOne();
      const refereeBalance = Number(refereeBalanceRaw?.balance || 0);
      await this.ledgerRepo.save(
        this.ledgerRepo.create({
          customerId: referredCustomerId,
          points: refereePts,
          balanceAfter: refereeBalance + refereePts,
          type: 'referral_bonus',
          referenceId: referrer.id,
          description: 'Reward for joining via referral',
          metadata: { referralCode: codeUsed.trim(), referrerCustomerId: referrer.id },
          expiresAt: rewardExpiresAt(),
        }),
      );
      await this.recordPointsSettlement(refereePts, {
        customerId: referredCustomerId,
        customerName: referred.fullName,
        description: 'Referral bonus for joining',
        reason: 'referral bonus',
        referralCode: codeUsed.trim(),
      });
    }

    meta.referralRewardApplied = true;
    referred.metadata = meta;
    await this.customerRepo.save(referred);

    await this.syncWalletMetadata(referrer.id);
    await this.syncWalletMetadata(referredCustomerId);
  }

  private async ensureWelcomeBonus(customerId: string): Promise<void> {
    const existing = await this.ledgerRepo.findOne({
      where: { customerId, type: 'welcome_bonus' },
      select: ['id'],
    });
    if (existing) return;

    const points = await getPlatformVarNumber(PLATFORM_VAR_KEYS.WELCOME_BONUS);
    if (!Number.isFinite(points) || points <= 0) return;

    const raw = await this.ledgerRepo
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.points), 0)', 'balance')
      .where('l.customer_id = :customerId', { customerId })
      .getRawOne();
    const currentBalance = Number(raw?.balance || 0);
    const row = this.ledgerRepo.create({
      customerId,
      points,
      balanceAfter: currentBalance + points,
      type: 'welcome_bonus',
      referenceId: null,
      description: 'Welcome bonus credited',
      metadata: { source: 'system', campaign: 'welcome_bonus' },
      expiresAt: rewardExpiresAt(),
    });
    await this.ledgerRepo.save(row);

    await this.recordPointsSettlement(points, {
      customerId,
      customerName: (await this.customerRepo.findOne({ where: { id: customerId } }))?.fullName ?? 'Customer',
      description: 'Welcome bonus for joining',
      reason: 'welcome bonus',
    });

    await this.syncWalletMetadata(customerId);
  }

  async getOrCreateReferralCode(customerId: string): Promise<string> {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) throw new Error('Customer not found');
    const meta = (customer.metadata || {}) as Record<string, unknown>;
    if (meta.referralCode) return meta.referralCode as string;

    const code = generateCode();
    meta.referralCode = code;
    customer.metadata = meta;
    await this.customerRepo.save(customer);
    return code;
  }

  async listMyReferrals(customerId: string, limit: number, offset: number) {
    const [items, total] = await this.referralRepo.findAndCount({
      where: { referrerCustomerId: customerId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total, limit, offset };
  }

  async getRewardBalance(customerId: string) {
    await this.ensureWelcomeBonus(customerId);
    await this.syncWalletMetadata(customerId);

    const balance = await getSpendablePointsBalance(this.ledgerRepo, customerId);

    const [history, total] = await this.ledgerRepo.findAndCount({
      where: { customerId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return { balance, recentHistory: history, totalEntries: total };
  }
}
