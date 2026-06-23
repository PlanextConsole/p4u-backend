import { Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { VendorRegistrationRequest } from '../entity/VendorRegistrationRequest';

export class VendorRegistrationRequestRepository {
  private repository: Repository<VendorRegistrationRequest>;

  constructor() {
    this.repository = AppDataSource.getRepository(VendorRegistrationRequest);
  }

  async findPendingByEmail(email: string): Promise<VendorRegistrationRequest | null> {
    return this.repository
      .createQueryBuilder('r')
      .where("r.status = 'pending'")
      .andWhere("JSON_UNQUOTE(JSON_EXTRACT(r.payload, '$.email')) = :email", { email })
      .orderBy('r.createdAt', 'DESC')
      .getOne();
  }

  /** Latest request (any status) authored by a given Keycloak user. */
  async findLatestByKeycloakUserId(
    keycloakUserId: string,
  ): Promise<VendorRegistrationRequest | null> {
    return this.repository
      .createQueryBuilder('r')
      .where(
        "JSON_UNQUOTE(JSON_EXTRACT(r.payload, '$.keycloakUserId')) = :kid",
        { kid: keycloakUserId },
      )
      .orderBy('r.createdAt', 'DESC')
      .getOne();
  }

  /** Latest signup row for a Firebase uid (vendor OTP registration audit trail). */
  async findLatestByFirebaseUid(firebaseUid: string): Promise<VendorRegistrationRequest | null> {
    return this.repository
      .createQueryBuilder('r')
      .where("JSON_UNQUOTE(JSON_EXTRACT(r.payload, '$.firebaseUid')) = :uid", {
        uid: firebaseUid,
      })
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
      .andWhere(
        "JSON_UNQUOTE(JSON_EXTRACT(r.payload, '$.keycloakUserId')) = :kid",
        { kid: keycloakUserId },
      )
      .orderBy('r.createdAt', 'DESC')
      .getOne();
  }

  async save(row: VendorRegistrationRequest): Promise<VendorRegistrationRequest> {
    return this.repository.save(row);
  }
}
