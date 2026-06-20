import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** Read-only mirror of admin's `vendor_plans`. */
@Entity('vendor_plans')
export class VendorPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'plan_name', type: 'varchar', length: 120 })
  planName!: string;

  @Column({ name: 'plan_type', type: 'varchar', length: 16 })
  planType!: string;

  @Column({ type: 'int', default: 1 })
  tier!: number;

  @Column({ name: 'commission_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  commissionPercent!: string;

  @Column({ name: 'max_user_redemption_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  maxUserRedemptionPercent!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
