import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

@Entity('social_post_saves')
@Unique(['postId', 'userId'])
export class PostSave {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'post_id', type: 'varchar', length: 36 })
  @Index()
  postId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 128 })
  @Index()
  userId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
