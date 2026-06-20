import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('customer_referrals')
export class CustomerReferral {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'referrer_customer_id', type: 'varchar', length: 36 })
  @Index()
  referrerCustomerId!: string;

  @Column({ name: 'referred_customer_id', type: 'varchar', length: 36, unique: true })
  referredCustomerId!: string;

  @Column({ name: 'referral_code', type: 'varchar', length: 32 })
  @Index()
  referralCode!: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  @Index()
  status!: string;

  @Column({ name: 'reward_points_earned', type: 'int', default: 0 })
  rewardPointsEarned!: number;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
