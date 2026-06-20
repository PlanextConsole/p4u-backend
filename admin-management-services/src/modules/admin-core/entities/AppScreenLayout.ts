import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/** Dynamic home / screen widget configuration (PRD §5.1). */
@Entity('admin_app_screen_layouts')
export class AppScreenLayout {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'screen_key', type: 'varchar', length: 64 })
  @Index()
  screenKey!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName!: string;

  /** Ordered widget definitions for the mobile app. */
  @Column({ name: 'widget_config', type: 'json' })
  widgetConfig!: unknown[];

  /** Targeting: userMode, geography, segment, KYC level, etc. */
  @Column({ name: 'targeting_rules', type: 'json', nullable: true })
  targetingRules!: Record<string, unknown> | null;

  @Column({ type: 'boolean', default: false })
  published!: boolean;

  /** Higher wins when multiple published layouts match (tie-break). */
  @Column({ name: 'priority', type: 'int', default: 0 })
  priority!: number;

  @Column({ name: 'valid_from', type: 'datetime', nullable: true })
  validFrom!: Date | null;

  @Column({ name: 'valid_to', type: 'datetime', nullable: true })
  validTo!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
