import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';


@Entity('commerce_coupons')
export class Coupon {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ type: 'varchar', length: 64 })
  @Index()
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  @Index()
  status!: string;

  @Column({ name: 'discount_json', type: 'json', nullable: true })
  discountJson!: Record<string, unknown> | null;

  @Column({ name: 'valid_from', type: 'timestamp', nullable: true })
  validFrom!: Date | null;

  @Column({ name: 'valid_to', type: 'timestamp', nullable: true })
  validTo!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
