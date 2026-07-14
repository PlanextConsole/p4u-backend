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

@Entity('commerce_coupon_usages')
export class CouponUsage {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'coupon_id', type: 'varchar', length: 36 })
  @Index()
  couponId!: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 36 })
  @Index()
  customerId!: string;

  @Column({ name: 'order_id', type: 'varchar', length: 36, nullable: true })
  orderId!: string | null;

  @Column({ name: 'discount_applied', type: 'decimal', precision: 12, scale: 2 })
  discountApplied!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
