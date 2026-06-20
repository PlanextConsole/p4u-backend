import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/** Read-only mirror of profile `customer_profiles` for checkout snapshots (same DB). */
@Entity({ name: 'customer_profiles', synchronize: false })
export class CustomerProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone!: string | null;

  @Column({ name: 'keycloak_user_id', type: 'varchar', length: 128, nullable: true })
  keycloakUserId!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;
}
