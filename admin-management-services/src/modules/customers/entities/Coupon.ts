import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('commerce_coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  @Index()
  status!: string;

  @Column({ name: 'discount_json', type: 'json', nullable: true })
  discountJson!: Record<string, unknown> | null;

  @Column({ name: 'valid_from', type: 'timestamp', nullable: true })
  validFrom!: Date | null;

  @Column({ name: 'valid_to', type: 'timestamp', nullable: true })
  validTo!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
