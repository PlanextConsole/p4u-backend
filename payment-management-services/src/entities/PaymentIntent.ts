import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';


@Entity('user_payment_intents')
export class PaymentIntent {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'order_id', type: 'varchar', length: 36 })
  @Index()
  orderId!: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  customerId!: string | null;

  @Column({ type: 'varchar', length: 16, default: 'INR' })
  currency!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount!: string;

  @Column({ type: 'varchar', length: 32, default: 'created' })
  @Index()
  status!: string;

  @Column({ name: 'provider_ref', type: 'varchar', length: 128, nullable: true })
  providerRef!: string | null;

  @Column({ name: 'provider_payment_id', type: 'varchar', length: 128, nullable: true })
  providerPaymentId!: string | null;

  @Column({ name: 'provider_signature', type: 'varchar', length: 256, nullable: true })
  providerSignature!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
