import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('customer_profiles')
export class CustomerProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ name: 'keycloak_user_id', type: 'varchar', length: 128, nullable: true })
  @Index()
  keycloakUserId!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;
}
