import { Entity, Column, PrimaryColumn, Index } from 'typeorm';

@Entity('social_conversation_state')
export class SocialConversationState {
  @PrimaryColumn({ name: 'conversation_id', type: 'varchar', length: 36 })
  conversationId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'varchar', length: 128 })
  @Index()
  userId!: string;

  @Column({ name: 'unread_count', type: 'int', default: 0 })
  unreadCount!: number;

  @Column({ name: 'last_read_at', type: 'datetime', precision: 6, nullable: true })
  lastReadAt!: Date | null;
}
