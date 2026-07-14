import { randomUUID } from 'crypto';

/** Assign a varchar UUID id when TypeORM/Postgres would otherwise insert null. */
export function newEntityId(existing?: string | null): string {
  const s = existing != null ? String(existing).trim() : '';
  return s || randomUUID();
}
