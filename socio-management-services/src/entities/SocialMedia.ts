import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';


/**
 * Socio post/story media metadata. File bytes live on disk under UPLOAD_DIR/media/{id}.ext;
 * posts/stories reference rows via path-only URL `/socio-uploads/media/{id}`.
 */
@Entity('social_media')
export class SocialMedia {
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

  @Column({ name: 'size_bytes', type: 'int', default: 0 })
  sizeBytes!: number;

  /** Relative path under UPLOAD_DIR, e.g. `media/{uuid}.jpg` */
  @Column({ name: 'storage_path', type: 'varchar', length: 512, nullable: true })
  storagePath!: string | null;

  /** Legacy blob — migrated to disk on startup; new rows leave this null. */
  @Column({ type: ((process.env.DB_TYPE || 'mysql').toLowerCase() === 'postgres' ? 'bytea' : 'longblob') as 'bytea' | 'longblob', nullable: true })
  data!: Buffer | null;

  @Column({ name: 'owner_id', type: 'varchar', length: 128 })
  @Index()
  ownerId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
