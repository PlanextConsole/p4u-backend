import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';


@Entity('classified_vendors')
export class ClassifiedVendor {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'vendor_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  vendorId!: string | null;

  @Column({ name: 'city_id', type: 'varchar', length: 36, nullable: true })
  cityId!: string | null;

  @Column({ name: 'area_id', type: 'varchar', length: 36, nullable: true })
  areaId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  displayName!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  @Index()
  isActive!: boolean;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
