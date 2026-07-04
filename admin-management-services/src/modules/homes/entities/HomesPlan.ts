import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'homes_plans' })
export class HomesPlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'plan_type', type: 'varchar', length: 32, default: 'owner' })
  planType!: string;

  @Column({ name: 'name', type: 'varchar', length: 120 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  price!: string;

  @Column({ name: 'duration_days', type: 'int', default: 30 })
  durationDays!: number;

  @Column({ name: 'listing_limit', type: 'int', default: 0 })
  listingLimit!: number;

  @Column({ name: 'contact_reveals', type: 'int', default: 0 })
  contactReveals!: number;

  @Column({ name: 'visibility_boost', type: 'boolean', default: false })
  visibilityBoost!: boolean;

  @Column({ name: 'features', type: 'json', nullable: true })
  features!: string[] | null;

  @Index()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}