import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('admin_platform_variables')
export class PlatformVariable {
  @PrimaryColumn({ type: 'varchar', length: 36 }) id!: string;
  @Column({ type: 'varchar', length: 128 }) key!: string;
  @Column({ type: 'json', nullable: true }) value!: unknown;
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive!: boolean;
}
