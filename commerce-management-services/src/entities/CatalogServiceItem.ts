import { randomUUID } from 'crypto';
import { BeforeInsert, Column, Entity, PrimaryColumn } from 'typeorm';


/** Minimal projection for booking slot duration hints (catalog_service_items). */
@Entity('catalog_service_items')
export class CatalogServiceItem {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;
}
