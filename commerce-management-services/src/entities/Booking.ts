import { randomUUID } from 'crypto';
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';

@Entity('commerce_bookings')
export class Booking {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'customer_id', type: 'varchar', length: 36 })
  @Index()
  customerId!: string;

  @Column({ name: 'vendor_id', type: 'varchar', length: 36 })
  @Index()
  vendorId!: string;

  @Column({ name: 'service_id', type: 'varchar', length: 36, nullable: true })
  serviceId!: string | null;

  @Column({ name: 'booking_date', type: 'date' })
  bookingDate!: string;

  @Column({ name: 'time_slot', type: 'varchar', length: 32 })
  timeSlot!: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  @Index()
  status!: string;

  @Column({ name: 'address_id', type: 'varchar', length: 36, nullable: true })
  addressId!: string | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
