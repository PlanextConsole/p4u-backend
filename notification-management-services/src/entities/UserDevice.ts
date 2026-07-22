import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';


@Entity('user_devices')
export class UserDevice {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'user_id', type: 'varchar', length: 128 })
  @Index()
  userId!: string;

  @Column({ name: 'device_token', type: 'varchar', length: 512 })
  @Index()
  deviceToken!: string;

  @Column({ name: 'platform', type: 'varchar', length: 32, default: 'web' })
  platform!: string;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
