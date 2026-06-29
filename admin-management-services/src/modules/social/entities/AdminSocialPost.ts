import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('social_posts')
export class AdminSocialPost {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'author_id', type: 'varchar', length: 128 })
  @Index()
  authorId!: string;

  @Column({ name: 'author_type', type: 'varchar', length: 16, default: 'customer' })
  authorType!: string;

  @Column({ name: 'content_text', type: 'text', nullable: true })
  contentText!: string | null;

  @Column({ name: 'media_urls', type: 'json', nullable: true })
  mediaUrls!: string[] | null;

  @Column({ name: 'post_type', type: 'varchar', length: 32, default: 'text' })
  postType!: string;

  @Column({ type: 'varchar', length: 16, default: 'public' })
  visibility!: string;

  @Column({ name: 'like_count', type: 'int', default: 0 })
  likeCount!: number;

  @Column({ name: 'comment_count', type: 'int', default: 0 })
  commentCount!: number;

  @Column({ name: 'share_count', type: 'int', default: 0 })
  shareCount!: number;

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
