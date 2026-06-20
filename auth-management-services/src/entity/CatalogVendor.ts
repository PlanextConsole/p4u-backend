import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Minimal mapping to `catalog_vendors` (owned by vendor-management-service).
 *
 * Auth-management-service only writes here as part of the vendor self-onboarding
 * flow: when a logged-in vendor user submits their profile, we create/upsert a
 * pending catalog_vendors row so admin's existing "Service vendors > Pending
 * Approval" UI picks it up immediately. Approval / verification continues to
 * happen via vendor-management-service + admin-web; we never mutate status here
 * after the initial pending insert.
 *
 * Columns deliberately limited to those touched by onboarding.
 */
@Entity('catalog_vendors')
export class CatalogVendor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'business_name', type: 'varchar', length: 255 })
  businessName!: string;

  @Column({ name: 'owner_name', type: 'varchar', length: 255 })
  ownerName!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gst!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  pan!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  @Index()
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  email!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  @Index()
  status!: string;

  @Column({ name: 'kyc_status', type: 'varchar', length: 32, default: 'not_started' })
  kycStatus!: string;

  @Column({ name: 'categories_json', type: 'json', nullable: true })
  categoriesJson!: unknown | null;

  @Column({ name: 'services_json', type: 'json', nullable: true })
  servicesJson!: unknown | null;

  @Column({ name: 'address_json', type: 'json', nullable: true })
  addressJson!: Record<string, unknown> | null;

  @Column({ name: 'documents_json', type: 'json', nullable: true })
  documentsJson!: Record<string, unknown> | null;

  @Column({ name: 'bank_json', type: 'json', nullable: true })
  bankJson!: Record<string, unknown> | null;

  @Column({ name: 'keycloak_user_id', type: 'varchar', length: 128, nullable: true })
  @Index()
  keycloakUserId!: string | null;

  @Column({ name: 'vendor_kind', type: 'varchar', length: 16, default: 'product' })
  @Index()
  vendorKind!: string;

  @Column({ name: 'vendor_type', type: 'varchar', length: 16, default: 'PRODUCT' })
  @Index()
  vendorType!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
