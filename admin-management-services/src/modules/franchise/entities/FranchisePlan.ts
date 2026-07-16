import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('franchise_plans')
export class FranchisePlan {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'plan_name', type: 'varchar', length: 120 }) @Index() planName!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ name: 'plan_type', type: 'varchar', length: 16 }) @Index() planType!: 'local' | 'vip';
  @Column({ type: 'int', default: 1 }) tier!: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) price!: string;
  @Column({ name: 'validity_days', type: 'int', default: 365 }) validityDays!: number;
  @Column({ name: 'visibility_type', type: 'varchar', length: 24, default: 'radius' }) visibilityType!: 'radius' | 'city' | 'state' | 'country';
  @Column({ name: 'radius_km', type: 'decimal', precision: 8, scale: 2, nullable: true }) radiusKm!: string | null;
  @Column({ name: 'royalty_percent', type: 'decimal', precision: 5, scale: 2, default: 0 }) royaltyPercent!: string;
  @Column({ name: 'max_user_redemption_percent', type: 'decimal', precision: 5, scale: 2, default: 0 }) maxUserRedemptionPercent!: string;
  @Column({ name: 'payment_mode', type: 'varchar', length: 16, default: 'both' }) paymentMode!: 'both' | 'online' | 'offline';
  @Column({ name: 'promo_banner_ads', type: 'boolean', default: false }) promoBannerAds!: boolean;
  @Column({ name: 'promo_video_ads', type: 'boolean', default: false }) promoVideoAds!: boolean;
  @Column({ name: 'promo_priority_listing', type: 'boolean', default: false }) promoPriorityListing!: boolean;
  @Column({ name: 'territory_exclusive', type: 'boolean', default: true }) territoryExclusive!: boolean;
  @Column({ name: 'training_included', type: 'boolean', default: false }) trainingIncluded!: boolean;
  @Column({ name: 'support_level', type: 'varchar', length: 32, nullable: true }) supportLevel!: 'basic' | 'premium' | 'enterprise' | null;
  @Column({ name: 'is_active', type: 'boolean', default: true }) @Index() isActive!: boolean;
  @Column({ type: 'json', nullable: true }) metadata!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
