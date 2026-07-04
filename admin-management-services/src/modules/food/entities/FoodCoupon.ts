import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'food_coupons' })
export class FoodCoupon {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Index({ unique: true }) @Column({ type: 'varchar', length: 60 }) code!: string;
  @Column({ type: 'varchar', length: 160 }) title!: string;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ name: 'discount_type', type: 'varchar', length: 30, default: 'flat' }) discountType!: string;
  @Column({ name: 'discount_value', type: 'decimal', precision: 10, scale: 2, default: 0 }) discountValue!: string;
  @Column({ name: 'max_discount', type: 'decimal', precision: 10, scale: 2, nullable: true }) maxDiscount!: string | null;
  @Column({ name: 'min_order', type: 'decimal', precision: 10, scale: 2, default: 0 }) minOrder!: string;
  @Column({ name: 'per_customer_limit', type: 'int', default: 1 }) perCustomerLimit!: number;
  @Column({ name: 'total_usage_limit', type: 'int', nullable: true }) totalUsageLimit!: number | null;
  @Column({ name: 'platform_wide', type: 'boolean', default: true }) platformWide!: boolean;
  @Column({ name: 'starts_at', type: 'datetime', nullable: true }) startsAt!: Date | null;
  @Column({ name: 'expires_at', type: 'datetime', nullable: true }) expiresAt!: Date | null;
  @Index() @Column({ name: 'is_active', type: 'boolean', default: true }) isActive!: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}