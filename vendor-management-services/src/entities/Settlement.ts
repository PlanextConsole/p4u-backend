import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Read-only mirror of `commerce_settlements` for the vendor portal payout view. */
@Entity('commerce_settlements')
export class Settlement {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'vendor_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  vendorId!: string | null;

  @Column({ name: 'order_id', type: 'varchar', length: 36, nullable: true })
  orderId!: string | null;

  @Column({ name: 'settlement_type', type: 'varchar', length: 32, default: 'cash' })
  settlementType!: string;

  @Column({ type: 'varchar', length: 64, default: 'pending' })
  status!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
