import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';


@Entity('social_media')
export class AdminSocialMedia {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

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
