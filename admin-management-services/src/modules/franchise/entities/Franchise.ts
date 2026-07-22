import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('franchises')
export class Franchise {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }
  @Column({ name: 'registration_id', type: 'varchar', length: 36, unique: true }) registrationId!: string;
  @Column({ name: 'plan_id', type: 'varchar', length: 36 }) @Index() planId!: string;
  @Column({ name: 'franchise_code', type: 'varchar', length: 32, unique: true }) @Index() franchiseCode!: string;
  @Column({ name: 'business_name', type: 'varchar', length: 255, nullable: true }) businessName!: string | null;
  @Column({ name: 'owner_name', type: 'varchar', length: 255 }) ownerName!: string;
  @Column({ type: 'varchar', length: 255, nullable: true }) email!: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) phone!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) city!: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) state!: string | null;
  @Column({ type: 'varchar', length: 16, nullable: true }) pincode!: string | null;
  @Column({ type: 'text', nullable: true }) address!: string | null;
  @Column({ name: 'territory_description', type: 'text', nullable: true }) territoryDescription!: string | null;
  @Column({ name: 'hierarchy_node_id', type: 'varchar', length: 36, nullable: true }) hierarchyNodeId!: string | null;
  @Column({ type: 'varchar', length: 24, default: 'active' }) @Index() status!: 'active' | 'suspended' | 'terminated';
  @Column({ name: 'plan_start_date', type: 'date' }) planStartDate!: string;
  @Column({ name: 'plan_end_date', type: 'date' }) planEndDate!: string;
  @Column({ name: 'payment_status', type: 'varchar', length: 24, default: 'pending' }) @Index() paymentStatus!: 'paid' | 'unpaid' | 'pending' | 'refunded';
  @Column({ name: 'payment_transaction_id', type: 'varchar', length: 128, nullable: true }) paymentTransactionId!: string | null;
  @Column({ name: 'royalty_percent', type: 'decimal', precision: 5, scale: 2, default: 0 }) royaltyPercent!: string;
  @Column({ name: 'is_active', type: 'boolean', default: true }) @Index() isActive!: boolean;
  @Column({ type: 'json', nullable: true }) metadata!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
