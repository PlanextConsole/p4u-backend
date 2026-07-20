import { randomUUID } from 'crypto';
import { Entity, PrimaryColumn, Column, CreateDateColumn, Index, BeforeInsert } from 'typeorm';

@Entity('admin_audit_logs')
export class AdminAuditLog {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

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
