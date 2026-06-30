import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/** Log of admin-initiated broadcast push attempts (FCM etc. can be wired later). */
@Entity('admin_push_notification_sends')
export class AdminPushNotificationSend {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'target_audience', type: 'varchar', length: 64 })
  @Index()
  targetAudience!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'deep_link', type: 'varchar', length: 512, nullable: true })
  deepLink!: string | null;

  @Column({ name: 'target_user_ids', type: 'simple-json', nullable: true })
  targetUserIds!: string[] | null;

  /** queued | sent | failed â€” MVP records sent after persist. */
  @Column({ type: 'varchar', length: 24, default: 'sent' })
  @Index()
  status!: string;

  @Column({ name: 'provider_detail', type: 'text', nullable: true })
  providerDetail!: string | null;

  @Column({ name: 'actor_sub', type: 'varchar', length: 255, nullable: true })
  actorSub!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

