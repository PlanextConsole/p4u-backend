import { Column, Entity, PrimaryColumn } from 'typeorm';

export type VendorPlanVisibility = 'radius' | 'city' | 'state' | 'country';

/** Read-only mirror of the admin-owned vendor_plans table. */
@Entity('vendor_plans')
export class VendorPlan {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'visibility_type', type: 'varchar', length: 24, default: 'radius' })
  visibilityType!: VendorPlanVisibility;

  @Column({ name: 'radius_km', type: 'decimal', precision: 8, scale: 2, nullable: true })
  radiusKm!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
