import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('social_media')
export class AdminSocialMedia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 16, default: 'image' })
  @Index()
  kind!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 512, nullable: true })
  originalName!: string | null;

  @Column({ name: 'owner_id', type: 'varchar', length: 128 })
  @Index()
  ownerId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
