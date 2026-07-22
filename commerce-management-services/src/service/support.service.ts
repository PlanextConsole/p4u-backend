import { randomUUID } from 'crypto';
import { AppDataSource } from '../config/database';

export type SupportActorType = 'customer' | 'vendor' | 'admin';
const ACTIVE = new Set(['open', 'in_progress', 'waiting_customer']);
const STATUSES = new Set([...ACTIVE, 'resolved', 'closed']);
const PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);

function cleanMessage(value: unknown) {
  const text = String(value || '').trim();
  if (text.length < 2) throw new Error('Message must contain at least 2 characters');
  if (text.length > 5000) throw new Error('Message cannot exceed 5000 characters');
  return text;
}

export class SupportService {
  async list(
    actorId: string,
    actorType: SupportActorType,
    input: { status?: string; q?: string; limit?: number; offset?: number } = {},
  ) {
    const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 100);
    const offset = Math.max(Number(input.offset) || 0, 0);
    const where: string[] = [];
    const args: unknown[] = [];
    const parameter = (value: unknown) => {
      args.push(value);
      return `$${args.length}`;
    };
    if (actorType !== 'admin') {
      where.push(`requester_id = ${parameter(actorId)} AND requester_type = ${parameter(actorType)}`);
    }
    if (input.status && STATUSES.has(input.status)) {
      where.push(`status = ${parameter(input.status)}`);
    }
    if (input.q) {
      const queryParameter = parameter(`%${input.q}%`);
      where.push(`(subject ILIKE ${queryParameter} OR category ILIKE ${queryParameter})`);
    }
    const filter = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count: any[] = await AppDataSource.query(
      `SELECT COUNT(*)::int AS total FROM support_tickets ${filter}`,
      args,
    );
    const limitParameter = `$${args.length + 1}`;
    const offsetParameter = `$${args.length + 2}`;
    const items = await AppDataSource.query(
      `SELECT * FROM support_tickets ${filter} ORDER BY updated_at DESC LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      [...args, limit, offset],
    );
    return { items, total: Number(count[0]?.total || 0), limit, offset };
  }

  async create(
    actorId: string,
    actorType: Exclude<SupportActorType, 'admin'>,
    input: any,
  ) {
    const subject = String(input.subject || '').trim();
    if (subject.length < 4 || subject.length > 180) {
      throw new Error('Subject must contain 4 to 180 characters');
    }
    const category = String(input.category || 'general').trim().toLowerCase().slice(0, 48);
    const priority = PRIORITIES.has(String(input.priority)) ? String(input.priority) : 'medium';
    const message = cleanMessage(input.message ?? input.description);
    const ticketId = randomUUID();
    const messageId = randomUUID();
    await AppDataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO support_tickets
          (id, requester_id, requester_type, subject, category, priority, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::json)`,
        [ticketId, actorId, actorType, subject, category, priority, 'open', JSON.stringify(input.metadata || {})],
      );
      await manager.query(
        `INSERT INTO support_ticket_messages
          (id, ticket_id, sender_id, sender_type, message, attachments)
         VALUES ($1, $2, $3, $4, $5, $6::json)`,
        [messageId, ticketId, actorId, actorType, message, JSON.stringify([])],
      );
    });
    return this.get(ticketId, actorId, actorType);
  }

  async get(ticketId: string, actorId: string, actorType: SupportActorType) {
    const rows: any[] = await AppDataSource.query(
      'SELECT * FROM support_tickets WHERE id = $1 LIMIT 1',
      [ticketId],
    );
    const ticket = rows[0];
    if (
      !ticket ||
      (actorType !== 'admin' &&
        (ticket.requester_id !== actorId || ticket.requester_type !== actorType))
    ) {
      throw new Error('Support ticket not found');
    }
    const messages = await AppDataSource.query(
      'SELECT * FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC, id ASC',
      [ticketId],
    );
    return { ...ticket, messages };
  }

  async addMessage(
    ticketId: string,
    actorId: string,
    actorType: SupportActorType,
    input: any,
  ) {
    const message = cleanMessage(input.message);
    const id = randomUUID();
    await AppDataSource.transaction(async (manager) => {
      const rows: any[] = await manager.query(
        'SELECT * FROM support_tickets WHERE id = $1 FOR UPDATE',
        [ticketId],
      );
      const ticket = rows[0];
      if (
        !ticket ||
        (actorType !== 'admin' &&
          (ticket.requester_id !== actorId || ticket.requester_type !== actorType))
      ) {
        throw new Error('Support ticket not found');
      }
      if (!ACTIVE.has(ticket.status)) {
        throw new Error('Resolved or closed tickets cannot receive messages');
      }
      const attachments = Array.isArray(input.attachments) ? input.attachments.slice(0, 5) : [];
      await manager.query(
        `INSERT INTO support_ticket_messages
          (id, ticket_id, sender_id, sender_type, message, attachments)
         VALUES ($1, $2, $3, $4, $5, $6::json)`,
        [id, ticketId, actorId, actorType, message, JSON.stringify(attachments)],
      );
      const nextStatus =
        actorType === 'admin'
          ? 'waiting_customer'
          : ticket.status === 'waiting_customer'
            ? 'in_progress'
            : ticket.status;
      await manager.query(
        'UPDATE support_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [nextStatus, ticketId],
      );
    });
    return this.get(ticketId, actorId, actorType);
  }

  async close(
    ticketId: string,
    actorId: string,
    actorType: Exclude<SupportActorType, 'admin'>,
  ) {
    const ticket = await this.get(ticketId, actorId, actorType);
    if (ticket.status !== 'closed') {
      await AppDataSource.query(
        `UPDATE support_tickets
         SET status = 'closed',
             resolved_at = COALESCE(resolved_at, CURRENT_TIMESTAMP),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [ticketId],
      );
    }
    return this.get(ticketId, actorId, actorType);
  }

  async administer(ticketId: string, adminId: string, input: any) {
    const status = input.status == null ? null : String(input.status);
    if (status && !STATUSES.has(status)) throw new Error('Invalid support ticket status');
    const assignedTo = input.assignedTo || adminId || null;
    await AppDataSource.transaction(async (manager) => {
      const rows: any[] = await manager.query(
        'SELECT * FROM support_tickets WHERE id = $1 FOR UPDATE',
        [ticketId],
      );
      if (!rows[0]) throw new Error('Support ticket not found');
      await manager.query(
        `UPDATE support_tickets
         SET status = COALESCE($1::varchar, status),
             assigned_to = COALESCE($2::varchar, assigned_to),
             resolved_at = CASE
               WHEN $1 IN ('resolved', 'closed') THEN COALESCE(resolved_at, CURRENT_TIMESTAMP)
               WHEN $1::varchar IS NOT NULL THEN NULL
               ELSE resolved_at
             END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [status, assignedTo, ticketId],
      );
    });
    return this.get(ticketId, adminId, 'admin');
  }
}
