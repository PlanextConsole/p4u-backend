import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';


@Entity('vendor_media_assets')
export class VendorMediaAsset {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'vendor_id', type: 'varchar', length: 36 })
  @Index()
  vendorId!: string;

  @Column({ name: 'folder_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  folderId!: string | null;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint', default: 0 })
  sizeBytes!: string;

  @Column({ type: 'varchar', length: 512 })
  url!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
