import { randomUUID } from 'crypto';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'homes_property_listings' })
export class HomesPropertyListing {
  // Postgres uses varchar(36) PK with no DEFAULT — do not use @PrimaryGeneratedColumn('uuid').
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'title', type: 'varchar', length: 180 })
  title!: string;

  @Column({ name: 'locality', type: 'varchar', length: 140, nullable: true })
  locality!: string | null;

  @Column({ name: 'city', type: 'varchar', length: 120, nullable: true })
  city!: string | null;

  @Column({ name: 'listing_type', type: 'varchar', length: 32, default: 'rent' })
  listingType!: string;

  @Column({ name: 'property_type', type: 'varchar', length: 80, default: 'Apartment' })
  propertyType!: string;

  @Column({ name: 'price', type: 'decimal', precision: 14, scale: 2, default: 0 })
  price!: string;

  @Column({ name: 'posted_by', type: 'varchar', length: 120, nullable: true })
  postedBy!: string | null;

  @Column({ name: 'photo_count', type: 'int', default: 0 })
  photoCount!: number;

  @Index()
  @Column({ name: 'moderation_status', type: 'varchar', length: 32, default: 'pending' })
  moderationStatus!: string;

  @Column({ name: 'is_reported', type: 'boolean', default: false })
  isReported!: boolean;

  @Column({ name: 'is_auto_flagged', type: 'boolean', default: false })
  isAutoFlagged!: boolean;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'details', type: 'json', nullable: true })
  details!: Record<string, unknown> | null;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
