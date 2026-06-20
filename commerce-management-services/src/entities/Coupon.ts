import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('commerce_coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32, unique: true })
  @Index()
  code!: string;

  @Column({ type: 'varchar', length: 32, default: 'percentage' })
  type!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  value!: string;

  @Column({ name: 'min_order_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  minOrderAmount!: string;

  @Column({ name: 'max_discount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  maxDiscount!: string | null;

  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usageLimit!: number | null;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount!: number;

  @Column({ name: 'per_user_limit', type: 'int', default: 1 })
  perUserLimit!: number;

  @Column({ name: 'valid_from', type: 'datetime', nullable: true })
  validFrom!: Date | null;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil!: Date | null;

  @Column({ name: 'applicable_vendor_ids', type: 'json', nullable: true })
  applicableVendorIds!: string[] | null;

  @Column({ name: 'applicable_category_ids', type: 'json', nullable: true })
  applicableCategoryIds!: string[] | null;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  @Index()
  status!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
