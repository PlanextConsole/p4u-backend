import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('food_order_status_history')
export class FoodOrderStatusHistory {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'order_id', type: 'varchar', length: 36 })
  @Index()
  orderId!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: string;

  @Column({ name: 'changed_by', type: 'varchar', length: 36, nullable: true })
  changedBy!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
