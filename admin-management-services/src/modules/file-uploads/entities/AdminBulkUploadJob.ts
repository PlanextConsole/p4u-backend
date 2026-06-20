import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type BulkUploadRowError = { row: number; message: string };

@Entity('admin_bulk_upload_jobs')
export class AdminBulkUploadJob {
  @PrimaryColumn('varchar', { length: 36 })
  id!: string;

  @Column({ name: 'upload_type', type: 'varchar', length: 24 })
  @Index()
  uploadType!: string;

  @Column({ name: 'original_filename', type: 'varchar', length: 512 })
  originalFilename!: string;

  @Column({ name: 'stored_relative_path', type: 'varchar', length: 512 })
  storedRelativePath!: string;

  /** processing | completed | partial | failed */
  @Column({ type: 'varchar', length: 24 })
  @Index()
  status!: string;

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows!: number;

  @Column({ name: 'success_count', type: 'int', default: 0 })
  successCount!: number;

  @Column({ name: 'error_count', type: 'int', default: 0 })
  errorCount!: number;

  @Column({ name: 'result_detail', type: 'json', nullable: true })
  resultDetail!: { rowErrors: BulkUploadRowError[] } | null;

  @Column({ name: 'actor_sub', type: 'varchar', length: 255, nullable: true })
  actorSub!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
