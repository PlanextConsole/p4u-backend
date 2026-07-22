import { AppDataSource } from './database';

export async function ensureSupportSchema() {
  await AppDataSource.query(`CREATE TABLE IF NOT EXISTS support_tickets (
    id varchar(36) NOT NULL PRIMARY KEY,
    requester_id varchar(64) NOT NULL,
    requester_type varchar(16) NOT NULL,
    subject varchar(180) NOT NULL,
    category varchar(48) NOT NULL DEFAULT 'general',
    priority varchar(16) NOT NULL DEFAULT 'medium',
    status varchar(24) NOT NULL DEFAULT 'open',
    assigned_to varchar(64) NULL,
    created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    resolved_at datetime(6) NULL,
    metadata json NULL,
    INDEX IDX_support_requester (requester_type, requester_id),
    INDEX IDX_support_status (status, updated_at)
  ) ENGINE=InnoDB`);
  await AppDataSource.query(`CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id varchar(36) NOT NULL PRIMARY KEY,
    ticket_id varchar(36) NOT NULL,
    sender_id varchar(64) NOT NULL,
    sender_type varchar(16) NOT NULL,
    message text NOT NULL,
    attachments json NULL,
    created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX IDX_support_message_ticket (ticket_id, created_at),
    CONSTRAINT FK_support_message_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`);
}
