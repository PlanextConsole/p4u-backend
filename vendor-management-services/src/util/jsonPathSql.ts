/** Build engine-safe JSON text extraction for TypeORM raw SQL fragments. */
export function isPostgresDb(): boolean {
  const dbType = (process.env.DB_TYPE || process.env.DATABASE_TYPE || 'mysql').toLowerCase();
  return dbType === 'postgres' || dbType === 'postgresql';
}

/**
 * Extract a scalar JSON field as text.
 * MySQL: JSON_UNQUOTE(JSON_EXTRACT(alias.col, '$.key'))
 * Postgres: (alias.col->>'key')
 */
export function jsonText(aliasColumn: string, key: string): string {
  if (isPostgresDb()) {
    return `(${aliasColumn}->>'${key}')`;
  }
  return `JSON_UNQUOTE(JSON_EXTRACT(${aliasColumn}, '$.${key}'))`;
}
