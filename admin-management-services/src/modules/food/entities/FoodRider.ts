import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'food_riders' })
export class FoodRider {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 140 }) name!: string;
  @Column({ type: 'varchar', length: 30, nullable: true }) mobile!: string | null;
  @Column({ type: 'varchar', length: 160, nullable: true }) email!: string | null;
  @Column({ name: 'vehicle_type', type: 'varchar', length: 40, default: 'Bike' }) vehicleType!: string;
  @Column({ name: 'vehicle_no', type: 'varchar', length: 40, nullable: true }) vehicleNo!: string | null;
  @Index() @Column({ name: 'kyc_status', type: 'varchar', length: 30, default: 'pending' }) kycStatus!: string;
  @Index() @Column({ name: 'is_active', type: 'boolean', default: true }) isActive!: boolean;
  @Column({ name: 'pending_balance', type: 'decimal', precision: 12, scale: 2, default: 0 }) pendingBalance!: string;
  @Column({ type: 'json', nullable: true }) documents!: Record<string, unknown> | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}