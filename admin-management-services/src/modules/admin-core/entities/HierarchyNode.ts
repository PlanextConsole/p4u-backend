import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';


/** Franchise / official hierarchy (PRD §5.2). */
@Entity('admin_hierarchy_nodes')
export class HierarchyNode {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'parent_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  parentId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'node_type', type: 'varchar', length: 64 })
  @Index()
  nodeType!: string;

  @Column({ name: 'responsible_user_id', type: 'varchar', length: 128, nullable: true })
  responsibleUserId!: string | null;

  @Column({ name: 'geo_zone', type: 'json', nullable: true })
  geoZone!: Record<string, unknown> | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
