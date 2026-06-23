import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('vendor_dropshipping_settings')
export class VendorDropshippingSettings {
  @PrimaryColumn({ name: 'vendor_id', type: 'varchar', length: 36 })
  vendorId!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ name: 'default_supplier_id', type: 'varchar', length: 36, nullable: true })
  defaultSupplierId!: string | null;

  @Column({ name: 'auto_forward_orders', type: 'boolean', default: false })
  autoForwardOrders!: boolean;

  @Column({ name: 'default_margin_percent', type: 'decimal', precision: 5, scale: 2, default: 20 })
  defaultMarginPercent!: string;

  @Column({ name: 'notify_on_status_change', type: 'boolean', default: true })
  notifyOnStatusChange!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
