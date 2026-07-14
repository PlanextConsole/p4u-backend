import { randomUUID } from 'crypto';
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
  BeforeInsert,
} from 'typeorm';

@Entity('commerce_reviews')
@Unique(['customerId', 'targetType', 'targetId'])
export class Review {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'customer_id', type: 'varchar', length: 36 })
  @Index()
  customerId!: string;

  @Column({ name: 'target_type', type: 'varchar', length: 32 })
  @Index()
  targetType!: string;

  @Column({ name: 'target_id', type: 'varchar', length: 36 })
  @Index()
  targetId!: string;

  @Column({ type: 'int' })
  rating!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ name: 'review_text', type: 'text', nullable: true })
  reviewText!: string | null;

  @Column({ name: 'images_json', type: 'json', nullable: true })
  imagesJson!: string[] | null;

  @Column({ type: 'varchar', length: 32, default: 'published' })
  @Index()
  status!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
