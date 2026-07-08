import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, Unique } from 'typeorm';

@Entity('social_conversations')
@Unique(['participantOneId', 'participantTwoId'])
export class SocialConversation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'participant_one_id', type: 'varchar', length: 128 })
  @Index()
  participantOneId!: string;

  @Column({ name: 'participant_two_id', type: 'varchar', length: 128 })
  @Index()
  participantTwoId!: string;

  @Column({ name: 'last_message_text', type: 'text', nullable: true })
  lastMessageText!: string | null;

  @Column({ name: 'last_message_at', type: 'timestamp', precision: 6, nullable: true })
  lastMessageAt!: Date | null;

  @Column({ name: 'is_request', type: 'boolean', default: false })
  isRequest!: boolean;

  @Column({ name: 'request_for_user_id', type: 'varchar', length: 128, nullable: true })
  requestForUserId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
