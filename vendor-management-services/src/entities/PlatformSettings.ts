import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ name: 'dropshipping_enabled', type: 'boolean', default: true })
  dropshippingEnabled!: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
