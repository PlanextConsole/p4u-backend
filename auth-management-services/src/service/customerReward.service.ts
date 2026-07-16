import { AppDataSource } from '../config/database';
import { CustomerProfile } from '../entity/CustomerProfile';
import { PlatformVariable } from '../entity/PlatformVariable';
import { RewardPointsLedger } from '../entity/RewardPointsLedger';
import { CommerceSettlement } from '../entity/CommerceSettlement';

function numeric(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    return numeric(row.amount ?? row.value);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function expiresAt(): Date {
  return new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
}

export class CustomerRewardService {
  async creditWelcomeBonus(customerId: string): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const customer = await manager.getRepository(CustomerProfile)
        .createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: customerId })
        .getOne();
      if (!customer) return;

      const ledger = manager.getRepository(RewardPointsLedger);
      const existing = await ledger.findOne({ where: { customerId, type: 'welcome_bonus' } });
      if (existing) return;

      const variable = await manager.getRepository(PlatformVariable)
        .createQueryBuilder('p')
        .where('LOWER(TRIM(p.key)) = :key', { key: 'welcome_bonus' })
        .andWhere('p.isActive = :active', { active: true })
        .getOne();
      const points = numeric(variable?.value) ?? 300;
      if (points <= 0) return;

      const balanceRaw = await ledger.createQueryBuilder('l')
        .select('COALESCE(SUM(l.points), 0)', 'balance')
        .where('l.customer_id = :customerId', { customerId })
        .getRawOne();
      const balance = Math.max(0, Number(balanceRaw?.balance || 0));
      const expiry = expiresAt();
      await ledger.save(ledger.create({
        customerId,
        points: Math.floor(points),
        balanceAfter: balance + Math.floor(points),
        type: 'welcome_bonus',
        referenceId: null,
        description: 'Welcome bonus credited at registration',
        metadata: { source: 'registration', campaign: 'welcome_bonus' },
        expiresAt: expiry,
      }));
      await manager.getRepository(CommerceSettlement).save(manager.getRepository(CommerceSettlement).create({
        settlementType: 'points',
        status: 'posted',
        amount: String(Math.floor(points)),
        metadata: {
          customerId,
          customerName: customer.fullName,
          type: 'welcome_bonus',
          reason: 'welcome bonus',
          description: 'Welcome bonus credited at registration',
          expiresAt: expiry.toISOString(),
        },
      }));
      customer.metadata = {
        ...(customer.metadata ?? {}),
        wallet: balance + Math.floor(points),
        walletBalance: balance + Math.floor(points),
      };
      await manager.getRepository(CustomerProfile).save(customer);
    });
  }
}
