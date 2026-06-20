import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MediaLibraryFolder } from './MediaLibraryFolder';

@Entity('media_library_assets')
export class MediaLibraryAsset {
  @PrimaryColumn('varchar', { length: 36 })
  id!: string;

  @Column({ name: 'folder_id', type: 'varchar', length: 36 })
  @Index()
  folderId!: string;

  @ManyToOne(() => MediaLibraryFolder, f => f.assets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folder_id' })
  folder?: MediaLibraryFolder;

  @Column({ name: 'original_name', type: 'varchar', length: 512 })
  originalName!: string;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl!: string;

  /** Path under `/uploads`, e.g. `media-library/{folderId}/{filename}` */
  @Column({ name: 'relative_path', type: 'varchar', length: 512 })
  relativePath!: string;

  @Column({ type: 'varchar', length: 160 })
  mime!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ name: 'storage_kind', type: 'varchar', length: 16, default: 'local' })
  @Index()
  storageKind!: string;

  @Column({ name: 'b2_key', type: 'varchar', length: 1024, nullable: true })
  b2Key!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
