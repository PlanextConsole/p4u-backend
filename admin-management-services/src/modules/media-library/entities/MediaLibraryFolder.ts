import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { MediaLibraryAsset } from './MediaLibraryAsset';

@Entity('media_library_folders')
export class MediaLibraryFolder {
  @PrimaryColumn('varchar', { length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 180, unique: true })
  @Index()
  slug!: string;

  /** `general` — main Media Files tab; `kyc` — KYC Documents tab */
  @Column({ type: 'varchar', length: 24, default: 'general' })
  @Index()
  kind!: string;

  @OneToMany(() => MediaLibraryAsset, a => a.folder)
  assets?: MediaLibraryAsset[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
