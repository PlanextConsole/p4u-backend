import { In } from 'typeorm';
import { AppDataSource } from '../../config/database';
import { AuditService } from '../admin-core/services/audit.service';
import { Product } from '../products/entities/Product';
import { ProductRequest } from '../products/entities/ProductRequest';
import { Order } from '../orders/entities/Order';
import { Settlement } from '../orders/entities/Settlement';
import { OrganizationOrder } from '../organization-orders/entities/OrganizationOrder';
import { VendorReview } from '../vendor-reviews/entities/VendorReview';
import { UserNotification } from '../notifications/entities/UserNotification';
import { Vendor } from './entities/Vendor';

/**
 * Cross-domain batch updates when a vendor is removed or deactivated.
 * Operates on the shared `p4u_admin_db` schema (no HTTP hops to sibling services).
 */
export type CascadeResource =
  | 'products'
  | 'orders'
  | 'settlements'
  | 'product_requests'
  | 'coupons'
  | 'vendor_reviews'
  | 'organization_orders'
  | 'service_notifications';

export class VendorCascadeService {
  private audit = new AuditService();

  private async logBatch(
    vendorId: string,
    resource: CascadeResource,
    updated: number,
    actorSub: string,
    ip: string | undefined,
  ): Promise<void> {
    await this.audit.log({
      actorSub,
      action: 'BATCH_UPDATE',
      entityType: 'Vendor',
      entityId: vendorId,
      metadata: { batch: resource, updated },
      ipAddress: ip ?? null,
    });
  }

  async acknowledgeBatch(
    vendorId: string,
    resource: CascadeResource,
    actorSub: string,
    ip: string | undefined,
  ): Promise<{ vendorId: string; resource: CascadeResource; updated: number; note: string }> {
    let updated = 0;

    switch (resource) {
      case 'products': {
        const result = await AppDataSource.getRepository(Product).update(
          { vendorId },
          { vendorId: null, isActive: false, moderationStatus: 'pending' },
        );
        updated = result.affected ?? 0;
        break;
      }
      case 'orders': {
        const result = await AppDataSource.getRepository(Order).update({ vendorId }, { vendorId: null });
        updated = result.affected ?? 0;
        break;
      }
      case 'settlements': {
        const result = await AppDataSource.getRepository(Settlement).update(
          { vendorId },
          { vendorId: null, status: 'void' },
        );
        updated = result.affected ?? 0;
        break;
      }
      case 'product_requests': {
        const result = await AppDataSource.getRepository(ProductRequest).update(
          { vendorId },
          { vendorId: null, status: 'rejected' },
        );
        updated = result.affected ?? 0;
        break;
      }
      case 'coupons': {
        updated = await this.detachVendorFromCoupons(vendorId);
        break;
      }
      case 'vendor_reviews': {
        const result = await AppDataSource.getRepository(VendorReview).update(
          { vendorId },
          { status: 'archived' },
        );
        updated = result.affected ?? 0;
        break;
      }
      case 'organization_orders': {
        const result = await AppDataSource.getRepository(OrganizationOrder).update(
          { vendorId },
          { isClaimed: false, status: 'unclaimed' },
        );
        updated = result.affected ?? 0;
        break;
      }
      case 'service_notifications': {
        updated = await this.deleteServiceNotificationsForVendor(vendorId, actorSub, ip).then((r) => r.deleted);
        break;
      }
      default:
        break;
    }

    await this.logBatch(vendorId, resource, updated, actorSub, ip);
    return {
      vendorId,
      resource,
      updated,
      note: updated > 0 ? 'Batch cascade applied.' : 'No rows matched vendor.',
    };
  }

  private async detachVendorFromCoupons(vendorId: string): Promise<number> {
    const rows: Array<{ id: string; applicable_vendor_ids: string | string[] | null }> =
      await AppDataSource.query(
        `SELECT id, applicable_vendor_ids FROM commerce_coupons
         WHERE applicable_vendor_ids IS NOT NULL
           AND JSON_CONTAINS(applicable_vendor_ids, JSON_QUOTE(?))`,
        [vendorId],
      );

    let updated = 0;
    for (const row of rows) {
      let ids: string[] = [];
      if (Array.isArray(row.applicable_vendor_ids)) {
        ids = row.applicable_vendor_ids;
      } else if (typeof row.applicable_vendor_ids === 'string') {
        try {
          ids = JSON.parse(row.applicable_vendor_ids) as string[];
        } catch {
          ids = [];
        }
      }
      const next = ids.filter((id) => id !== vendorId);
      const status = next.length === 0 && ids.length === 1 ? 'inactive' : undefined;
      if (status) {
        await AppDataSource.query(
          `UPDATE commerce_coupons SET applicable_vendor_ids = ?, status = ? WHERE id = ?`,
          [JSON.stringify(next.length ? next : null), status, row.id],
        );
      } else {
        await AppDataSource.query(`UPDATE commerce_coupons SET applicable_vendor_ids = ? WHERE id = ?`, [
          JSON.stringify(next.length ? next : null),
          row.id,
        ]);
      }
      updated += 1;
    }
    return updated;
  }

  async deleteServiceNotificationsForVendor(
    vendorId: string,
    actorSub: string,
    ip: string | undefined,
  ): Promise<{ vendorId: string; deleted: number; note: string }> {
    const vendor = await AppDataSource.getRepository(Vendor).findOne({ where: { id: vendorId } });
    const userIds = [vendorId];
    if (vendor?.keycloakUserId) userIds.push(vendor.keycloakUserId);

    const repo = AppDataSource.getRepository(UserNotification);
    const toDelete = await repo
      .createQueryBuilder('n')
      .where('n.user_id IN (:...userIds)', { userIds })
      .orWhere("JSON_UNQUOTE(JSON_EXTRACT(n.metadata, '$.vendorId')) = :vendorId", { vendorId })
      .getMany();

    if (toDelete.length > 0) {
      await repo.delete({ id: In(toDelete.map((n) => n.id)) });
    }

    await this.logBatch(vendorId, 'service_notifications', toDelete.length, actorSub, ip);
    return {
      vendorId,
      deleted: toDelete.length,
      note: toDelete.length > 0 ? 'Vendor notifications removed.' : 'No notifications matched vendor.',
    };
  }
}
