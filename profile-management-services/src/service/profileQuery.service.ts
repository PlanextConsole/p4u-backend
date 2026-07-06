import { AppDataSource } from '../config/database';
import { Customer } from '../entities/Customer';
import { ReferralService } from './referral.service';

export class ProfileQueryService {
  private referralSvc = new ReferralService();
  async getCustomerById(customerId: string) {
    return AppDataSource.getRepository(Customer).findOne({ where: { id: customerId } });
  }

  async getCustomerByKeycloakSub(sub: string) {
    return AppDataSource.getRepository(Customer).findOne({ where: { keycloakUserId: sub } });
  }

  async updateCustomerById(customerId: string, patch: Record<string, unknown>) {
    const repo = AppDataSource.getRepository(Customer);
    const row = await repo.findOne({ where: { id: customerId } });
    if (!row) throw new Error('Customer not found');

    const nameVal = patch.fullName ?? patch.name;
    if (typeof nameVal === 'string' && nameVal.trim()) row.fullName = nameVal.trim();

    if (patch.email !== undefined) {
      const e = patch.email;
      row.email = e === null || e === '' ? null : String(e);
    }
    if (patch.phone !== undefined) {
      const p = patch.phone;
      row.phone = p === null || p === '' ? null : String(p);
    }
    if (patch.occupationId !== undefined) {
      const occ = patch.occupationId;
      row.occupationId = occ === null || occ === '' ? null : String(occ);
    }

    const prev =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? { ...(row.metadata as Record<string, unknown>) }
        : {};
    if (typeof patch.dob === 'string' && patch.dob.trim()) prev.dob = patch.dob.trim();
    if (typeof patch.gender === 'string' && patch.gender.trim()) prev.gender = patch.gender.trim();
    if (patch.metadata !== undefined && typeof patch.metadata === 'object' && !Array.isArray(patch.metadata)) {
      Object.assign(prev, patch.metadata as Record<string, unknown>);
    }
    row.metadata = Object.keys(prev).length ? prev : null;

    const saved = await repo.save(row);
    await this.referralSvc.applyReferralForReferredCustomer(saved.id);
    return saved;
  }
}
