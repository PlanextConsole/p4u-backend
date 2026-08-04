import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('social_content_reports')
@Index('uq_social_report_reporter_target', ['reporterId', 'targetType', 'targetId'], { unique: true })
export class ContentReport {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() { if (!this.id) this.id = randomUUID(); }

  @Column({ name: 'reporter_id', type: 'varchar', length: 128 })
  @Index()
  reporterId!: string;

  @Column({ name: 'target_type', type: 'varchar', length: 16 })
  targetType!: 'post' | 'comment';

  @Column({ name: 'target_id', type: 'varchar', length: 36 })
  @Index()
  targetId!: string;

  @Column({ type: 'varchar', length: 32 })
  reason!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  details!: string | null;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  @Index()
  status!: 'pending' | 'reviewed' | 'dismissed' | 'actioned';

  @Column({ name: 'moderator_id', type: 'varchar', length: 128, nullable: true })
  moderatorId!: string | null;

  @Column({ name: 'moderator_note', type: 'varchar', length: 500, nullable: true })
  moderatorNote!: string | null;

  @Column({ name: 'moderation_action', type: 'varchar', length: 24, nullable: true })
  moderationAction!: string | null;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
