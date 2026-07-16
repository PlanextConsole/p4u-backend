import { In } from 'typeorm';
import { AppDataSource } from '../config/database';
import { CustomerProfile } from '../entities/CustomerProfile';
import { CustomerReferral } from '../entities/CustomerReferral';
import { Order } from '../entities/Order';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';
import { Settlement } from '../entities/Settlement';
import { getPlatformVarNumber, PLATFORM_VAR_KEYS } from './platformVariable.reader';
import { getSpendablePointsBalance, rewardExpiresAt } from './rewardBalance';

function appliedCode(customer: CustomerProfile): string | null {
  const metadata = customer.metadata ?? {};
  const value = customer.referralCode ?? metadata.appliedReferralCode ?? metadata.referralCodeUsed;
  const code = String(value ?? '').trim();
  return code || null;
}

function ownedCode(customer: CustomerProfile): string | null {
  const value = customer.metadata?.referralCode ?? customer.metadata?.referral_code;
  const code = String(value ?? '').trim().toUpperCase();
  return code || null;
}

export class CustomerReferralRewardService {
  async applyAfterFirstPurchase(orderCustomerId: string, orderId: string): Promise<void> {
    await AppDataSource.transaction(async (manager) => {
      const customerRepo = manager.getRepository(CustomerProfile);
      let referred = await customerRepo.findOne({ where: { id: orderCustomerId } });
      if (!referred) referred = await customerRepo.findOne({ where: { keycloakUserId: orderCustomerId } });
      if (!referred) return;

      referred = await customerRepo.createQueryBuilder('c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id: referred.id })
        .getOne();
      if (!referred) return;

      const existing = await manager.getRepository(CustomerReferral).findOne({ where: { referredCustomerId: referred.id } });
      if (existing) return;

      const customerKeys = [referred.id, referred.keycloakUserId, orderCustomerId].filter(Boolean) as string[];
      const purchases = await manager.getRepository(Order).count({ where: { customerId: In([...new Set(customerKeys)]) } });
      if (purchases < 1) return;

      const code = appliedCode(referred);
      if (!code) return;
      const normalized = code.toUpperCase();
      const customers = await customerRepo.find();
      const referrer = customers.find((customer) => customer.id !== referred!.id && ownedCode(customer) === normalized);
      if (!referrer) return;

      const points = Math.floor(await getPlatformVarNumber(PLATFORM_VAR_KEYS.REFERRAL_BONUS));
      if (points <= 0) return;
      const ledgerRepo = manager.getRepository(RewardPointsLedger);
      const balance = await getSpendablePointsBalance(ledgerRepo, referrer.id);

      await manager.getRepository(CustomerReferral).save(manager.getRepository(CustomerReferral).create({
        referrerCustomerId: referrer.id,
        referredCustomerId: referred.id,
        referralCode: code,
        status: 'completed',
        rewardPointsEarned: points,
        metadata: { source: 'first_purchase', firstOrderId: orderId },
      }));
      const expiry = rewardExpiresAt();
      await ledgerRepo.save(ledgerRepo.create({
        customerId: referrer.id,
        points,
        balanceAfter: balance + points,
        type: 'customer_referral',
        referenceId: referred.id,
        description: 'Customer referral reward after first purchase',
        metadata: { referredCustomerId: referred.id, firstOrderId: orderId, referralCode: code },
        expiresAt: expiry,
      }));
      await manager.getRepository(Settlement).save(manager.getRepository(Settlement).create({
        settlementType: 'points',
        status: 'posted',
        amount: String(points),
        metadata: { customerId: referrer.id, reason: 'customer referral reward', referredCustomerId: referred.id, firstOrderId: orderId, expiresAt: expiry.toISOString() },
      }));
      referred.metadata = { ...(referred.metadata ?? {}), referralRewardApplied: true, referralRewardOrderId: orderId };
      await customerRepo.save(referred);
    });
  }
}
