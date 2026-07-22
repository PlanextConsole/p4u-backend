import { AppDataSource } from './database';

async function runIgnorable(sql: string): Promise<void> {
  try {
    await AppDataSource.query(sql);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/already exists|duplicate/i.test(message)) return;
    throw error;
  }
}

export async function ensureSupportSchema() {
  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id varchar(36) NOT NULL PRIMARY KEY,
      requester_id varchar(64) NOT NULL,
      requester_type varchar(16) NOT NULL,
      subject varchar(180) NOT NULL,
      category varchar(48) NOT NULL DEFAULT 'general',
      priority varchar(16) NOT NULL DEFAULT 'medium',
      status varchar(24) NOT NULL DEFAULT 'open',
      assigned_to varchar(64) NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at timestamp NULL,
      metadata json NULL
    )
  `);
  await runIgnorable(
    `CREATE INDEX IF NOT EXISTS IDX_support_requester ON support_tickets (requester_type, requester_id)`,
  );
  await runIgnorable(
    `CREATE INDEX IF NOT EXISTS IDX_support_status ON support_tickets (status, updated_at)`,
  );

  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS support_ticket_messages (
      id varchar(36) NOT NULL PRIMARY KEY,
      ticket_id varchar(36) NOT NULL,
      sender_id varchar(64) NOT NULL,
      sender_type varchar(16) NOT NULL,
      message text NOT NULL,
      attachments json NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT FK_support_message_ticket FOREIGN KEY (ticket_id)
        REFERENCES support_tickets(id) ON DELETE CASCADE
    )
  `);
  await runIgnorable(
    `CREATE INDEX IF NOT EXISTS IDX_support_message_ticket ON support_ticket_messages (ticket_id, created_at)`,
  );
}
