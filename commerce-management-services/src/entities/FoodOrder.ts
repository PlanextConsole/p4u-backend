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

@Entity('food_orders')
export class FoodOrder {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'order_ref', type: 'varchar', length: 64 })
  @Index({ unique: true })
  orderRef!: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 36 })
  @Index()
  customerId!: string;

  @Column({ name: 'customer_name', type: 'varchar', length: 160, nullable: true })
  customerName!: string | null;

  @Column({ name: 'customer_phone', type: 'varchar', length: 32, nullable: true })
  customerPhone!: string | null;

  @Column({ name: 'restaurant_id', type: 'varchar', length: 36 })
  @Index()
  restaurantId!: string;

  @Column({ name: 'restaurant_name', type: 'varchar', length: 160 })
  restaurantName!: string;

  @Column({ type: 'json' })
  items!: Record<string, unknown>[];

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: string;

  @Column({ name: 'packaging_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  packagingFee!: string;

  @Column({ name: 'delivery_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  deliveryFee!: string;

  @Column({ name: 'rider_tip', type: 'decimal', precision: 12, scale: 2, default: 0 })
  riderTip!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  gst!: string;

  @Column({ name: 'platform_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  platformFee!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  discount!: string;

  @Column({ name: 'points_used', type: 'int', default: 0 })
  pointsUsed!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total!: string;

  @Column({ name: 'rider_payout', type: 'decimal', precision: 12, scale: 2, default: 0 })
  riderPayout!: string;

  @Column({ name: 'restaurant_payout', type: 'decimal', precision: 12, scale: 2, default: 0 })
  restaurantPayout!: string;

  @Column({ name: 'platform_cut', type: 'decimal', precision: 12, scale: 2, default: 0 })
  platformCut!: string;

  @Column({ name: 'delivery_address', type: 'text' })
  deliveryAddress!: string;

  @Column({ name: 'delivery_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  deliveryLat!: string | null;

  @Column({ name: 'delivery_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  deliveryLng!: string | null;

  @Column({ name: 'distance_km', type: 'decimal', precision: 7, scale: 2, nullable: true })
  distanceKm!: string | null;

  @Column({ name: 'eta_minutes', type: 'int', nullable: true })
  etaMinutes!: number | null;

  @Column({ name: 'handover_otp', type: 'varchar', length: 6 })
  handoverOtp!: string;

  @Column({ name: 'payment_method', type: 'varchar', length: 32 })
  paymentMethod!: string;

  @Column({ name: 'payment_status', type: 'varchar', length: 24, default: 'pending' })
  paymentStatus!: string;

  @Column({ name: 'coupon_code', type: 'varchar', length: 64, nullable: true })
  couponCode!: string | null;

  @Column({ name: 'refund_status', type: 'varchar', length: 24, nullable: true })
  refundStatus!: string | null;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  refundAmount!: string;

  @Column({ name: 'invoice_no', type: 'varchar', length: 64, nullable: true })
  invoiceNo!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'placed' })
  @Index()
  status!: string;

  @Column({ name: 'customer_notes', type: 'text', nullable: true })
  customerNotes!: string | null;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason!: string | null;

  @Column({ name: 'scheduled_for', type: 'timestamp', nullable: true })
  scheduledFor!: Date | null;

  @Column({ name: 'placed_at', type: 'timestamp' })
  placedAt!: Date;

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt!: Date | null;

  @Column({ name: 'ready_at', type: 'timestamp', nullable: true })
  readyAt!: Date | null;

  @Column({ name: 'picked_up_at', type: 'timestamp', nullable: true })
  pickedUpAt!: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
