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

@Entity('commerce_orders')
export class Order {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'vendor_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  vendorId!: string | null;

  @Column({ name: 'customer_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  customerId!: string | null;

  @Column({ name: 'order_ref', type: 'varchar', length: 64, nullable: true })
  @Index()
  orderRef!: string | null;

  @Column({ type: 'varchar', length: 64, default: 'created' })
  @Index()
  status!: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
