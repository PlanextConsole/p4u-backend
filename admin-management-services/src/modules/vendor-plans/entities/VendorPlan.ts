import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';


export type VendorPlanType = 'local' | 'vip';
export type VendorPlanVisibility = 'radius' | 'city' | 'state' | 'country';
export type VendorPlanPaymentMode = 'both' | 'online' | 'offline';

@Entity('vendor_plans')
export class VendorPlan {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'plan_name', type: 'varchar', length: 120 })
  @Index()
  planName!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'plan_type', type: 'varchar', length: 16 })
  @Index()
  planType!: VendorPlanType;

  @Column({ type: 'int', default: 1 })
  tier!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price!: string;

  @Column({ name: 'validity_days', type: 'int', default: 30 })
  validityDays!: number;

  @Column({ name: 'visibility_type', type: 'varchar', length: 24, default: 'radius' })
  visibilityType!: VendorPlanVisibility;

  @Column({ name: 'radius_km', type: 'decimal', precision: 8, scale: 2, nullable: true })
  radiusKm!: string | null;

  @Column({ name: 'commission_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  commissionPercent!: string;

  @Column({ name: 'max_user_redemption_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  maxUserRedemptionPercent!: string;

  @Column({ name: 'payment_mode', type: 'varchar', length: 16, default: 'both' })
  paymentMode!: VendorPlanPaymentMode;

  @Column({ name: 'promo_banner_ads', type: 'boolean', default: false })
  promoBannerAds!: boolean;

  @Column({ name: 'promo_video_ads', type: 'boolean', default: false })
  promoVideoAds!: boolean;

  @Column({ name: 'promo_priority_listing', type: 'boolean', default: false })
  promoPriorityListing!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  @Index()
  isActive!: boolean;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

