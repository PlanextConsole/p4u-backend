import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Read-only mirror of admin's `admin_platform_variables` (shared DB). */
@Entity('admin_platform_variables')
export class PlatformVariable {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ type: 'varchar', length: 128, unique: true })
  key!: string;

  @Column({ type: 'json' })
  value!: unknown;

  @Column({ type: 'varchar', length: 64, nullable: true })
  category!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  @Index()
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
