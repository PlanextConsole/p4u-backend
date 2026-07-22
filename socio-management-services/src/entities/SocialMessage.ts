import { randomUUID } from 'crypto';
import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';


@Entity('social_messages')
export class SocialMessage {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @BeforeInsert()
  ensureId() {
    if (!this.id) this.id = randomUUID();
  }

  @Column({ name: 'conversation_id', type: 'varchar', length: 36 })
  @Index()
  conversationId!: string;

  @Column({ name: 'sender_id', type: 'varchar', length: 128 })
  @Index()
  senderId!: string;

  @Column({ name: 'content_text', type: 'text', nullable: true })
  contentText!: string | null;

  @Column({ name: 'media_url', type: 'text', nullable: true })
  mediaUrl!: string | null;

  @Column({ name: 'media_type', type: 'varchar', length: 16, nullable: true })
  mediaType!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
