import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('admin_audit_logs')
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'actor_sub', type: 'varchar', length: 128 })
  @Index()
  actorSub!: string;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  action!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  @Index()
  entityType!: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 36, nullable: true })
  entityId!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt!: Date;
}
