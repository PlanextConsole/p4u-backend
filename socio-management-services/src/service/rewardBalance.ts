import { Repository } from 'typeorm';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';

export function rewardExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
}

export async function getSpendablePointsBalance(repo: Repository<RewardPointsLedger>, customerId: string): Promise<number> {
  const rows = await repo.find({ where: { customerId }, select: ['points', 'expiresAt', 'createdAt'] });
  let activeCredits = 0;
  let expiredCredits = 0;
  let debits = 0;
  const now = Date.now();
  for (const row of rows) {
    if (row.points < 0) debits += -row.points;
    else if ((row.expiresAt ?? rewardExpiresAt(row.createdAt)).getTime() <= now) expiredCredits += row.points;
    else activeCredits += row.points;
  }
  return Math.max(0, activeCredits - Math.max(0, debits - expiredCredits));
}
