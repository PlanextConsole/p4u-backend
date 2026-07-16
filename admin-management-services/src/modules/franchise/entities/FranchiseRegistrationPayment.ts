import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('franchise_registration_payments')
export class FranchiseRegistrationPayment {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'registration_id', type: 'varchar', length: 36 }) @Index() registrationId!: string;
  @Column({ name: 'franchise_id', type: 'varchar', length: 36, nullable: true }) @Index() franchiseId!: string | null;
  @Column({ name: 'plan_id', type: 'varchar', length: 36 }) @Index() planId!: string;
  @Column({ type: 'decimal', precision: 14, scale: 2 }) amount!: string;
  @Column({ type: 'varchar', length: 8, default: 'INR' }) currency!: string;
  @Column({ name: 'payment_mode', type: 'varchar', length: 24 }) paymentMode!: 'online' | 'offline' | 'bank_transfer';
  @Column({ name: 'payment_status', type: 'varchar', length: 24, default: 'pending' }) @Index() paymentStatus!: 'pending' | 'success' | 'failed' | 'refunded';
  @Column({ name: 'transaction_id', type: 'varchar', length: 128, nullable: true }) transactionId!: string | null;
  @Column({ name: 'gateway_reference', type: 'varchar', length: 128, nullable: true }) gatewayReference!: string | null;
  @Column({ name: 'paid_at', type: 'timestamp', nullable: true }) paidAt!: Date | null;
  @Column({ name: 'recorded_by', type: 'varchar', length: 128, nullable: true }) recordedBy!: string | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @Column({ type: 'json', nullable: true }) metadata!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
