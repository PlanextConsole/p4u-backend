import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('content_featured_products')
export class FeaturedProduct {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'image_url', type: 'varchar', length: 512 })
  imageUrl!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  section!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  price!: string | null;

  @Column({ name: 'redirect_url', type: 'varchar', length: 512, nullable: true })
  redirectUrl!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  @Index()
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
