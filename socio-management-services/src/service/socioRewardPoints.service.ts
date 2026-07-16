import { EntityManager } from 'typeorm';
import { AppDataSource } from '../config/database';
import { CustomerProfile } from '../entities/CustomerProfile';
import { RewardPointsLedger } from '../entities/RewardPointsLedger';
import { CommerceSettlement } from '../entities/CommerceSettlement';
import { getPlatformVarNumber, PLATFORM_VAR_KEYS, type PlatformVarKey } from './platformVariable.reader';
import { getSpendablePointsBalance, rewardExpiresAt } from './rewardBalance';

type LedgerType = 'post_like' | 'post_share' | 'story_like';

const VAR_BY_TYPE: Record<LedgerType, PlatformVarKey> = {
  post_like: PLATFORM_VAR_KEYS.POST_LIKE_POINTS,
  post_share: PLATFORM_VAR_KEYS.POST_SHARE_POINTS,
  story_like: PLATFORM_VAR_KEYS.STORY_LIKE_POINTS,
};

const DESCRIPTION_BY_TYPE: Record<LedgerType, string> = {
  post_like: 'Points for liking a post',
  post_share: 'Points for sharing a post',
  story_like: 'Points for liking a story',
};

export class SocioRewardPointsService {
  async resolveCustomerIdFromKeycloakSub(manager: EntityManager, sub: string): Promise<string | null> {
    const row = await manager.getRepository(CustomerProfile).findOne({ where: { keycloakUserId: sub } });
    return row?.id ?? null;
  }

  private async syncWalletMetadata(manager: EntityManager, customerId: string): Promise<void> {
    const ledgerRepo = manager.getRepository(RewardPointsLedger);
    const balance = await getSpendablePointsBalance(ledgerRepo, customerId);
    const customer = await manager.getRepository(CustomerProfile).findOne({ where: { id: customerId } });
    if (!customer) return;
    const meta = { ...(customer.metadata || {}), wallet: balance, walletBalance: balance };
    customer.metadata = meta;
    await manager.getRepository(CustomerProfile).save(customer);
  }

  private async creditEvent(
    manager: EntityManager,
    keycloakSub: string,
    type: LedgerType,
    referenceId: string,
    extraMetadata: Record<string, unknown>,
    sign: 1 | -1 = 1,
  ): Promise<void> {
    const customerId = await this.resolveCustomerIdFromKeycloakSub(manager, keycloakSub);
    if (!customerId) return;

    const configured = await getPlatformVarNumber(VAR_BY_TYPE[type]);
    if (!Number.isFinite(configured) || configured <= 0) return;
    const ledgerRepo = manager.getRepository(RewardPointsLedger);
    const currentBalance = await getSpendablePointsBalance(ledgerRepo, customerId);
    const points = sign < 0 ? -Math.min(configured, currentBalance) : configured;
    if (points === 0) return;
    const description = sign < 0 ? `Reversal: ${DESCRIPTION_BY_TYPE[type]}` : DESCRIPTION_BY_TYPE[type];

    const customer = await manager.getRepository(CustomerProfile).findOne({ where: { id: customerId } });
    const name = customer?.fullName ?? 'Customer';

    const expiry = sign > 0 ? rewardExpiresAt() : null;
    await ledgerRepo.save(
      ledgerRepo.create({
        customerId,
        points,
        balanceAfter: currentBalance + points,
        type,
        referenceId,
        description,
        metadata: { source: 'socio', ...extraMetadata },
        expiresAt: expiry,
      }),
    );

    await manager.getRepository(CommerceSettlement).save(
      manager.getRepository(CommerceSettlement).create({
        settlementType: 'points',
        status: 'posted',
        amount: String(points),
        metadata: {
          customerId,
          customerName: name,
          description,
          reason: type.replace('_', ' '),
          ...(expiry ? { expiresAt: expiry.toISOString() } : {}),
          ...extraMetadata,
        },
      }),
    );

    await this.syncWalletMetadata(manager, customerId);
  }

  /** Credits post-like points to the POST OWNER inside an existing transaction. */
  async creditPostLikeInTransaction(
    manager: EntityManager,
    ownerKeycloakSub: string,
    postId: string,
    likerKeycloakSub: string,
  ): Promise<void> {
    return this.creditEvent(manager, ownerKeycloakSub, 'post_like', postId, { postId, likerId: likerKeycloakSub }, 1);
  }

  /** Reverses post-like points from the POST OWNER when the like is removed. */
  async reversePostLikeInTransaction(
    manager: EntityManager,
    ownerKeycloakSub: string,
    postId: string,
    likerKeycloakSub: string,
  ): Promise<void> {
    return this.creditEvent(manager, ownerKeycloakSub, 'post_like', postId, { postId, likerId: likerKeycloakSub }, -1);
  }

  /** Credits post-share points (single credit per share event). */
  async creditPostShareInTransaction(manager: EntityManager, keycloakSub: string, postId: string): Promise<void> {
    return this.creditEvent(manager, keycloakSub, 'post_share', postId, { postId });
  }

  /** Credits story-like points to the story owner (single credit per liker). */
  async creditStoryLikeInTransaction(manager: EntityManager, ownerKeycloakSub: string, storyId: string, likerKeycloakSub: string): Promise<void> {
    return this.creditEvent(manager, ownerKeycloakSub, 'story_like', storyId, { storyId, likerId: likerKeycloakSub });
  }
}

// Keep AppDataSource import to satisfy TypeORM module-load order in the service container.
void AppDataSource;
