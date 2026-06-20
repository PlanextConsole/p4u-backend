import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Stores socio media bytes directly in the database (per current spec — no object store yet).
 * Posts/stories reference these rows via a path-only URL of the shape
 *   `/socio-uploads/media/{id}`
 * which the gateway/frontend resolve through the standard socio static prefix.
 */
@Entity('social_media')
export class SocialMedia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** 'image' | 'video' — coarse kind for client rendering decisions. */
  @Column({ type: 'varchar', length: 16, default: 'image' })
  @Index()
  kind!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 512, nullable: true })
  originalName!: string | null;

  @Column({ name: 'size_bytes', type: 'int', default: 0 })
  sizeBytes!: number;

  /** Raw bytes. LONGBLOB in MySQL (up to 4GB; multer cap keeps it well below that). */
  @Column({ type: 'longblob' })
  data!: Buffer;

  /** Uploader's keycloak sub. Used for ownership checks on DELETE. */
  @Column({ name: 'owner_id', type: 'varchar', length: 128 })
  @Index()
  ownerId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
