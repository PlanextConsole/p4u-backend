import { Repository } from 'typeorm';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';

export const REWARD_EXPIRY_DAYS = 60;

export function rewardExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + REWARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export async function getSpendablePointsBalance(
  repo: Repository<RewardPointsLedger>,
  customerId: string,
  now = new Date(),
): Promise<number> {
  const rows = await repo.find({ where: { customerId }, select: ['points', 'expiresAt', 'createdAt'] });
  let activeCredits = 0;
  let expiredCredits = 0;
  let debits = 0;
  for (const row of rows) {
    if (row.points < 0) {
      debits += -row.points;
      continue;
    }
    const expiry = row.expiresAt ?? rewardExpiresAt(row.createdAt);
    if (expiry.getTime() <= now.getTime()) expiredCredits += row.points;
    else activeCredits += row.points;
  }
  return Math.max(0, activeCredits - Math.max(0, debits - expiredCredits));
}
