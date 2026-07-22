import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'food_orders' })
export class FoodOrder {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }
  @Column({ name: 'order_no', type: 'varchar', length: 60 }) orderNo!: string;
  @Column({ name: 'restaurant_id', type: 'varchar', length: 80, nullable: true }) restaurantId!: string | null;
  @Column({ name: 'restaurant_name', type: 'varchar', length: 160, nullable: true }) restaurantName!: string | null;
  @Column({ name: 'customer_name', type: 'varchar', length: 140, nullable: true }) customerName!: string | null;
  @Column({ name: 'rider_id', type: 'varchar', length: 80, nullable: true }) riderId!: string | null;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) total!: string;
  @Index() @Column({ type: 'varchar', length: 40, default: 'pending' }) status!: string;
  @Column({ name: 'payment_status', type: 'varchar', length: 40, default: 'pending' }) paymentStatus!: string;
  @Column({ type: 'json', nullable: true }) items!: Record<string, unknown>[] | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}