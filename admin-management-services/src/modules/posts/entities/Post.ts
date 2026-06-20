import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('content_posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'author_customer_id', type: 'varchar', length: 36, nullable: true })
  authorCustomerId!: string | null;

  @Column({ name: 'author_vendor_id', type: 'varchar', length: 36, nullable: true })
  authorVendorId!: string | null;

  @Column({ type: 'text', nullable: true })
  content!: string | null;

  @Column({ type: 'varchar', length: 64, default: 'published' })
  @Index()
  status!: string;

  @Column({ name: 'media_json', type: 'json', nullable: true })
  mediaJson!: unknown | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
