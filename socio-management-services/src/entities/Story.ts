import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('social_stories')
export class Story {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'author_id', type: 'varchar', length: 128 })
  @Index()
  authorId!: string;

  @Column({ name: 'media_url', type: 'varchar', length: 512 })
  mediaUrl!: string;

  @Column({ name: 'media_type', type: 'varchar', length: 16, default: 'image' })
  mediaType!: string;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 512, nullable: true })
  thumbnailUrl!: string | null;

  @Column({ name: 'text_overlay', type: 'varchar', length: 255, nullable: true })
  textOverlay!: string | null;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount!: number;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt!: Date;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  @Index()
  status!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
