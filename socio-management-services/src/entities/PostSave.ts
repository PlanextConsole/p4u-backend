import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, Unique } from 'typeorm';


@Entity('social_post_saves')
@Unique(['postId', 'userId'])
export class PostSave {
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
