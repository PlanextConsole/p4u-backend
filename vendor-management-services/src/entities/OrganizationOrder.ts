import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('commerce_organization_orders')
export class OrganizationOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'vendor_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  vendorId!: string | null;

  @Column({ name: 'customer_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  customerId!: string | null;

  @Column({ name: 'referral_code', type: 'varchar', length: 64, nullable: true })
  @Index()
  referralCode!: string | null;

  @Column({ type: 'varchar', length: 64, default: 'created' })
  @Index()
  status!: string;

  @Column({ name: 'is_claimed', type: 'boolean', default: false })
  @Index()
  isClaimed!: boolean;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
