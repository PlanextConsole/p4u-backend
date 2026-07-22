import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'homes_localities' })
export class HomesLocality {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Index()
  @Column({ name: 'name', type: 'varchar', length: 140 })
  name!: string;

  @Index()
  @Column({ name: 'city', type: 'varchar', length: 120 })
  city!: string;

  @Column({ name: 'is_popular', type: 'boolean', default: false })
  isPopular!: boolean;

  @Column({ name: 'avg_rent', type: 'decimal', precision: 12, scale: 2, default: 0 })
  avgRent!: string;

  @Column({ name: 'avg_sale_price', type: 'decimal', precision: 14, scale: 2, default: 0 })
  avgSalePrice!: string;

  @Column({ name: 'life_score', type: 'decimal', precision: 4, scale: 1, default: 0 })
  lifeScore!: string;

  @Column({ name: 'score_breakdown', type: 'json', nullable: true })
  scoreBreakdown!: Record<string, unknown> | null;

  @Column({ name: 'seo_title', type: 'varchar', length: 255, nullable: true })
  seoTitle!: string | null;

  @Column({ name: 'seo_description', type: 'text', nullable: true })
  seoDescription!: string | null;

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