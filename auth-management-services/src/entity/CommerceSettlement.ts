import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('commerce_settlements')
export class CommerceSettlement {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }
  @Column({ name: 'settlement_type', type: 'varchar', length: 32 }) settlementType!: string;
  @Column({ type: 'varchar', length: 32, default: 'posted' }) status!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) amount!: string;
  @Column({ type: 'json', nullable: true }) metadata!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}
