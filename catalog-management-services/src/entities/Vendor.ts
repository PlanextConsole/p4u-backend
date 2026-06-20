import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/** Mirrors admin `catalog_vendors` (shared DB) so public catalog API returns image URLs. */
@Entity('catalog_vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'business_name', type: 'varchar', length: 255 })
  businessName!: string;

  @Column({ name: 'owner_name', type: 'varchar', length: 255 })
  ownerName!: string;

  @Column({ type: 'int', nullable: true })
  age!: number | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  gender!: string | null;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 512, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ name: 'banner_url', type: 'varchar', length: 512, nullable: true })
  bannerUrl!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  gst!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  pan!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  @Index()
  phone!: string | null;

  @Column({ name: 'secondary_phone', type: 'varchar', length: 32, nullable: true })
  secondaryPhone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  email!: string | null;

  @Column({ name: 'membership_status', type: 'varchar', length: 32, nullable: true })
  membershipStatus!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'not_verified' })
  @Index()
  status!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  experience!: string | null;

  @Column({ type: 'boolean', default: false })
  trending!: boolean;

  @Column({ name: 'applied_referral_code', type: 'varchar', length: 64, nullable: true })
  appliedReferralCode!: string | null;

  @Column({ name: 'about_business', type: 'text', nullable: true })
  aboutBusiness!: string | null;

  @Column({ name: 'kyc_status', type: 'varchar', length: 32, default: 'not_started' })
  kycStatus!: string;

  @Column({ name: 'categories_json', type: 'json', nullable: true })
  categoriesJson!: unknown | null;

  @Column({ name: 'services_json', type: 'json', nullable: true })
  servicesJson!: unknown | null;

  @Column({ name: 'address_json', type: 'json', nullable: true })
  addressJson!: Record<string, unknown> | null;

  @Column({ name: 'commission_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  commissionRate!: string | null;

  @Column({ name: 'max_redemption_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  maxRedemptionPercent!: string | null;

  @Column({ name: 'vendor_plan_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  vendorPlanId!: string | null;

  @Column({ name: 'enrollment_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  enrollmentCost!: string | null;

  @Column({ name: 'coverage_radius_km', type: 'decimal', precision: 8, scale: 2, nullable: true })
  coverageRadiusKm!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  restriction!: string | null;

  @Column({ name: 'self_delivery', type: 'boolean', default: false })
  selfDelivery!: boolean;

  @Column({ name: 'documents_json', type: 'json', nullable: true })
  documentsJson!: Record<string, unknown> | null;

  @Column({ name: 'bank_json', type: 'json', nullable: true })
  bankJson!: Record<string, unknown> | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 512, nullable: true })
  logoUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'keycloak_user_id', type: 'varchar', length: 128, nullable: true })
  @Index()
  keycloakUserId!: string | null;

  @Column({ name: 'vendor_kind', type: 'varchar', length: 16, default: 'product' })
  vendorKind!: string;

  @Column({ name: 'vendor_type', type: 'varchar', length: 16, default: 'PRODUCT' })
  vendorType!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
