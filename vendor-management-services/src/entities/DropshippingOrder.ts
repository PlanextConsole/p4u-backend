import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('dropshipping_orders')
export class DropshippingOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id', type: 'varchar', length: 36 })
  @Index()
  orderId!: string;

  @Column({ name: 'vendor_id', type: 'varchar', length: 36 })
  @Index()
  vendorId!: string;

  @Column({ name: 'supplier_id', type: 'varchar', length: 36 })
  supplierId!: string;

  @Column({ name: 'supplier_order_ref', type: 'varchar', length: 128, nullable: true })
  supplierOrderRef!: string | null;

  @Column({ type: 'json', nullable: true })
  items!: unknown | null;

  @Column({ name: 'cost_total', type: 'decimal', precision: 12, scale: 2, default: 0 })
  costTotal!: string;

  @Column({ name: 'margin_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  marginAmount!: string;

  @Column({ name: 'currency_code', type: 'varchar', length: 8, default: 'INR' })
  currencyCode!: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  @Index()
  status!: string;

  @Column({ name: 'tracking_number', type: 'varchar', length: 128, nullable: true })
  trackingNumber!: string | null;

  @Column({ name: 'tracking_url', type: 'varchar', length: 512, nullable: true })
  trackingUrl!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  carrier!: string | null;

  @Column({ name: 'forwarded_at', type: 'timestamp', nullable: true })
  forwardedAt!: Date | null;

  @Column({ name: 'expected_delivery_date', type: 'date', nullable: true })
  expectedDeliveryDate!: string | null;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
