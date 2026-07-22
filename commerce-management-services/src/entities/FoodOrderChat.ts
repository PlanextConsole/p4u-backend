import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('food_order_chats')
export class FoodOrderChat {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'order_id', type: 'varchar', length: 36 })
  @Index()
  orderId!: string;

  @Column({ name: 'sender_id', type: 'varchar', length: 36 })
  senderId!: string;

  @Column({ name: 'sender_role', type: 'varchar', length: 20 })
  senderRole!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
