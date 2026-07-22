import { randomUUID } from 'crypto';
import { BeforeInsert, Column, Entity, Index, PrimaryColumn } from 'typeorm';


@Entity('customer_profiles')
export class CustomerProfile {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ name: 'keycloak_user_id', type: 'varchar', length: 128, nullable: true })
  @Index()
  keycloakUserId!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;
}
