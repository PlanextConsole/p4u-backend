import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { CustomerProfile } from '../entity/CustomerProfile';

export class CustomerProfileRepository {
  private repository: Repository<CustomerProfile>;

  constructor() {
    this.repository = AppDataSource.getRepository(CustomerProfile);
  }

  async findByKeycloakUserId(keycloakUserId: string): Promise<CustomerProfile | null> {
    return this.repository.findOne({ where: { keycloakUserId } });
  }

  /**
   * Phone lookup for OTP login. Phone numbers are stored in mixed formats in
   * the wild (with/without +91, with/without leading zero), so callers should
   * pre-normalize and pass the same shape that signup writes (E.164, e.g.
   * "+919876543210"). Falls back to the bare 10-digit form for legacy rows.
   */
  async findByPhone(e164: string): Promise<CustomerProfile | null> {
    const last10 = e164.replace(/\D/g, '').slice(-10);
    const candidates = [e164, last10, `+91${last10}`, `91${last10}`].filter(
      (v, i, arr) => v && arr.indexOf(v) === i,
    );
    for (const candidate of candidates) {
      const row = await this.repository.findOne({ where: { phone: candidate } });
      if (row) return row;
    }
    return null;
  }

  async save(profile: CustomerProfile): Promise<CustomerProfile> {
    return this.repository.save(profile);
  }
}
