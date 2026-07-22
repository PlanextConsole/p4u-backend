import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';


@Entity('dropshipping_suppliers')
export class DropshippingSupplier {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail!: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 64, nullable: true })
  contactPhone!: string | null;

  @Column({ name: 'country_code', type: 'varchar', length: 8, nullable: true })
  countryCode!: string | null;

  @Column({ name: 'currency_code', type: 'varchar', length: 8, default: 'INR' })
  currencyCode!: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  website!: string | null;

  @Column({ name: 'default_lead_time_days', type: 'int', default: 7 })
  defaultLeadTimeDays!: number;

  @Column({ name: 'default_markup_percent', type: 'decimal', precision: 5, scale: 2, default: 20 })
  defaultMarkupPercent!: string;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  @Index()
  status!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
