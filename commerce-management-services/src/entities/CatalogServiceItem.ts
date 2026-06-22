import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/** Minimal projection for booking slot duration hints (catalog_service_items). */
@Entity('catalog_service_items')
export class CatalogServiceItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;
}
