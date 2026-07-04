import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'food_restaurants' })
export class FoodRestaurant {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'varchar', length: 160 }) title!: string;
  @Column({ type: 'varchar', length: 180, nullable: true }) tagline!: string | null;
  @Column({ type: 'text', nullable: true }) description!: string | null;
  @Column({ type: 'json', nullable: true }) cuisines!: string[] | null;
  @Column({ type: 'varchar', length: 255 }) address!: string;
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true }) latitude!: string | null;
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true }) longitude!: string | null;
  @Column({ type: 'varchar', length: 30, nullable: true }) phone!: string | null;
  @Column({ name: 'vendor_id', type: 'varchar', length: 80, nullable: true }) vendorId!: string | null;
  @Column({ name: 'cover_image_url', type: 'varchar', length: 500, nullable: true }) coverImageUrl!: string | null;
  @Column({ name: 'banner_url', type: 'varchar', length: 500, nullable: true }) bannerUrl!: string | null;
  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true }) logoUrl!: string | null;
  @Column({ name: 'gallery_urls', type: 'json', nullable: true }) galleryUrls!: string[] | null;
  @Column({ name: 'fssai_license', type: 'varchar', length: 120, nullable: true }) fssaiLicense!: string | null;
  @Column({ name: 'opening_time', type: 'varchar', length: 20, nullable: true }) openingTime!: string | null;
  @Column({ name: 'closing_time', type: 'varchar', length: 20, nullable: true }) closingTime!: string | null;
  @Column({ name: 'avg_prep_min', type: 'int', default: 20 }) avgPrepMin!: number;
  @Column({ name: 'delivery_radius_km', type: 'decimal', precision: 8, scale: 2, default: 8 }) deliveryRadiusKm!: string;
  @Column({ name: 'packaging_fee', type: 'decimal', precision: 10, scale: 2, default: 15 }) packagingFee!: string;
  @Column({ name: 'min_order', type: 'decimal', precision: 10, scale: 2, default: 99 }) minOrder!: string;
  @Column({ name: 'commission_percent', type: 'decimal', precision: 5, scale: 2, default: 20 }) commissionPercent!: string;
  @Column({ name: 'is_pure_veg', type: 'boolean', default: false }) isPureVeg!: boolean;
  @Index() @Column({ name: 'is_active', type: 'boolean', default: true }) isActive!: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}