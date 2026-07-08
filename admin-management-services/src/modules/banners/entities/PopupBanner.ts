import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('content_popup_banners')
export class PopupBanner {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ name: 'image_url', type: 'varchar', length: 512 })
  imageUrl!: string;

  @Column({ name: 'redirect_url', type: 'varchar', length: 512, nullable: true })
  redirectUrl!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  @Index()
  isActive!: boolean;

  @Column({ name: 'valid_from', type: 'timestamp', nullable: true })
  validFrom!: Date | null;

  @Column({ name: 'valid_to', type: 'timestamp', nullable: true })
  validTo!: Date | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
