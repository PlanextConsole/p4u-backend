import { randomUUID } from 'crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('food_reviews')
export class FoodReview {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'order_id', type: 'varchar', length: 36 })
  @Index({ unique: true })
  orderId!: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 36 })
  @Index()
  customerId!: string;

  @Column({ name: 'restaurant_id', type: 'varchar', length: 36 })
  @Index()
  restaurantId!: string;

  @Column({ name: 'food_rating', type: 'int' })
  foodRating!: number;

  @Column({ name: 'delivery_rating', type: 'int', nullable: true })
  deliveryRating!: number | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'image_urls', type: 'json', nullable: true })
  imageUrls!: string[] | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
