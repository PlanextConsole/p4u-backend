import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';


/**
 * `customer_profiles` is owned conceptually by admin-management-service but
 * the auth-service writes here during phone-OTP signup. Keep column types in
 * sync with `admin-management-services/.../entities/Customer.ts` to prevent
 * drift; the new address/location columns below are added by schemaRepair on
 * boot.
 */
@Entity('customer_profiles')
export class CustomerProfile {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  email!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  @Index()
  phone!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  @Index()
  status!: string;

  @Column({ name: 'occupation_id', type: 'varchar', length: 36, nullable: true })
  occupationId!: string | null;

  @Column({ name: 'keycloak_user_id', type: 'varchar', length: 128, nullable: true })
  @Index()
  keycloakUserId!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  state!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  district!: string | null;

  @Column({ name: 'area_locality', type: 'varchar', length: 255, nullable: true })
  areaLocality!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  pincode!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: string | null;

  @Column({ name: 'referral_code', type: 'varchar', length: 64, nullable: true })
  referralCode!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
