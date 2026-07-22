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

@Entity('food_restaurants')
export class FoodRestaurant {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'vendor_id', type: 'varchar', length: 36 })
  @Index({ unique: true })
  vendorId!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  tagline!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'json', nullable: true })
  cuisine!: string[] | null;

  @Column({ name: 'veg_only', type: 'boolean', default: false })
  vegOnly!: boolean;

  @Column({ name: 'cover_image', type: 'varchar', length: 1024, nullable: true })
  coverImage!: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 1024, nullable: true })
  logoUrl!: string | null;

  @Column({ name: 'fssai_license', type: 'varchar', length: 64, nullable: true })
  fssaiLicense!: string | null;

  @Column({ type: 'text' })
  address!: string;

  @Column({ name: 'city_id', type: 'varchar', length: 36, nullable: true })
  @Index()
  cityId!: string | null;

  @Column({ name: 'area_id', type: 'varchar', length: 36, nullable: true })
  areaId!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'opening_time', type: 'varchar', length: 8, nullable: true })
  openingTime!: string | null;

  @Column({ name: 'closing_time', type: 'varchar', length: 8, nullable: true })
  closingTime!: string | null;

  @Column({ name: 'avg_prep_minutes', type: 'int', default: 30 })
  avgPrepMinutes!: number;

  @Column({ name: 'delivery_radius_km', type: 'decimal', precision: 6, scale: 2, default: 10 })
  deliveryRadiusKm!: string;

  @Column({ name: 'packaging_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  packagingFee!: string;

  @Column({ name: 'min_order_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  minOrderAmount!: string;

  @Column({ name: 'commission_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  commissionRate!: string;

  @Column({ type: 'varchar', length: 24, default: 'offline' })
  @Index()
  status!: string;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  @Index()
  isActive!: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating!: string;

  @Column({ name: 'reviews_count', type: 'int', default: 0 })
  reviewsCount!: number;

  @Column({ name: 'total_orders', type: 'int', default: 0 })
  totalOrders!: number;

  @Column({ name: 'gallery_urls', type: 'json', nullable: true })
  galleryUrls!: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
