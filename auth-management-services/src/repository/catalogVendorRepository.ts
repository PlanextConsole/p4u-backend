import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { CatalogVendor } from '../entity/CatalogVendor';

export class CatalogVendorRepository {
  private repository: Repository<CatalogVendor>;

  constructor() {
    this.repository = AppDataSource.getRepository(CatalogVendor);
  }

  /** Look up a catalog vendor row by Keycloak user id (1:1 link). */
  async findByKeycloakUserId(keycloakUserId: string): Promise<CatalogVendor | null> {
    return this.repository.findOne({ where: { keycloakUserId } });
  }

  /**
   * Phone lookup for vendor OTP login. Phone numbers are stored in mixed
   * formats (with/without +91, with/without leading zero), so we try the
   * E.164 form first and fall back to common variants.
   */
  async findByPhone(e164: string): Promise<CatalogVendor | null> {
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

  async save(row: CatalogVendor): Promise<CatalogVendor> {
    return this.repository.save(row);
  }
}
