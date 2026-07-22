import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';


@Entity('vendor_reviews')
export class VendorReview {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'vendor_id', type: 'varchar', length: 36 })
  @Index()
  vendorId!: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 36, nullable: true })
  customerId!: string | null;

  @Column({ type: 'int' })
  rating!: number;

  @Column({ type: 'text', nullable: true })
  review!: string | null;

  @Column({ type: 'varchar', length: 64, default: 'published' })
  @Index()
  status!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
