import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

@Entity('social_user_follows')
@Unique(['followerId', 'followingId'])
export class UserFollow {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'follower_id', type: 'varchar', length: 128 })
  @Index()
  followerId!: string;

  @Column({ name: 'following_id', type: 'varchar', length: 128 })
  @Index()
  followingId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
