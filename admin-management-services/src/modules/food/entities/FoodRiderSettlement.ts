import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'food_rider_settlements' })
export class FoodRiderSettlement {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'rider_id', type: 'varchar', length: 80 }) riderId!: string;
  @Column({ name: 'rider_name', type: 'varchar', length: 140 }) riderName!: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 }) amount!: string;
  @Index() @Column({ type: 'varchar', length: 40, default: 'pending' }) status!: string;
  @Column({ name: 'paid_at', type: 'timestamp', nullable: true }) paidAt!: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}