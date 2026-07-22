import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';


/** Mirror of socio-management-services PostComment — shared `social_post_comments` table. */
@Entity('social_post_comments')
export class SocialPostComment {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'post_id', type: 'varchar', length: 36 })
  @Index()
  postId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 128 })
  @Index()
  userId!: string;

  @Column({ name: 'content_text', type: 'text' })
  contentText!: string;

  @Column({ type: 'varchar', length: 32, default: 'published' })
  status!: string;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
