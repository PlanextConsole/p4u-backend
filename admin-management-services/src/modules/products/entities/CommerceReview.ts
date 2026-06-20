import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** Mirror of commerce-management-services Review — shared `commerce_reviews` table. */
@Entity('commerce_reviews')
export class CommerceReview {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

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

  @Column({ name: 'review_text', type: 'text', nullable: true })
  reviewText!: string | null;

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
