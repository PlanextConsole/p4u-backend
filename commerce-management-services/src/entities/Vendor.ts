import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** Read-only mirror of admin's `catalog_vendors`. Only fields commerce needs are projected. */
@Entity('catalog_vendors')
export class Vendor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'business_name', type: 'varchar', length: 255 })
  businessName!: string;

  @Column({ name: 'commission_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  commissionRate!: string | null;

  @Column({ name: 'max_redemption_percent', type: 'decimal', precision: 5, scale: 2, nullable: true })
  maxRedemptionPercent!: string | null;

  @Column({ name: 'vendor_plan_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  vendorPlanId!: string | null;

  @Column({ name: 'self_delivery', type: 'boolean', default: false })
  selfDelivery!: boolean;

  /** Service-vendor weekly schedule + time off; drives `/bookings/available-slots`. */
  @Column({ name: 'booking_availability_json', type: 'json', nullable: true })
  bookingAvailabilityJson!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
