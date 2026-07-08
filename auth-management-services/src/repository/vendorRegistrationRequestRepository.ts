import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { VendorRegistrationRequest } from '../entity/VendorRegistrationRequest';
import { jsonText } from '../util/jsonPathSql';

export class VendorRegistrationRequestRepository {
  private repository: Repository<VendorRegistrationRequest>;

  constructor() {
    this.repository = AppDataSource.getRepository(VendorRegistrationRequest);
  }

  async findPendingByEmail(email: string): Promise<VendorRegistrationRequest | null> {
    return this.repository
      .createQueryBuilder('r')
      .where("r.status = 'pending'")
      .andWhere(`${jsonText('r.payload', 'email')} = :email`, { email })
      .orderBy('r.createdAt', 'DESC')
      .getOne();
  }

  /** Latest request (any status) authored by a given Keycloak user. */
  async findLatestByKeycloakUserId(
    keycloakUserId: string,
  ): Promise<VendorRegistrationRequest | null> {
    return this.repository
      .createQueryBuilder('r')
      .where(`${jsonText('r.payload', 'keycloakUserId')} = :kid`, { kid: keycloakUserId })
      .orderBy('r.createdAt', 'DESC')
      .getOne();
  }

  /**
   * Latest signup request (any status) whose payload phone matches by last-10
   * digits. Used by the no-OTP vendor flow to detect pending/rejected requests
   * for a phone before sending an OTP.
   */
  async findLatestByPhone(phone: string): Promise<VendorRegistrationRequest | null> {
    const last10 = String(phone || '').replace(/\D/g, '').slice(-10);
    if (last10.length < 10) return null;
    return this.repository
      .createQueryBuilder('r')
      .where(`${jsonText('r.payload', 'phone')} LIKE :p`, { p: `%${last10}` })
      .orderBy('r.createdAt', 'DESC')
      .getOne();
  }

  /** Latest signup row for a Firebase uid (vendor OTP registration audit trail). */
  async findLatestByFirebaseUid(firebaseUid: string): Promise<VendorRegistrationRequest | null> {
    return this.repository
      .createQueryBuilder('r')
      .where(`${jsonText('r.payload', 'firebaseUid')} = :uid`, { uid: firebaseUid })
      .orderBy('r.createdAt', 'DESC')
      .getOne();
  }

  /** Latest still-pending request authored by a given Keycloak user. */
  async findPendingByKeycloakUserId(
    keycloakUserId: string,
  ): Promise<VendorRegistrationRequest | null> {
    return this.repository
      .createQueryBuilder('r')
      .where("r.status = 'pending'")
      .andWhere(`${jsonText('r.payload', 'keycloakUserId')} = :kid`, { kid: keycloakUserId })
      .orderBy('r.createdAt', 'DESC')
      .getOne();
  }

  async save(row: VendorRegistrationRequest): Promise<VendorRegistrationRequest> {
    return this.repository.save(row);
  }
}
