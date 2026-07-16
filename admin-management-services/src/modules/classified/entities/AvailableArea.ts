import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('classified_available_areas')
export class AvailableArea {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'city_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  cityId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  name!: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 32, nullable: true })
  postalCode!: string | null;

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
