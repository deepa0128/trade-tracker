import postgres from 'postgres';

export type Sql = postgres.Sql;

let _sql: Sql | null = null;

/**
 * Returns the shared postgres connection pool.
 * Creating the pool is deferred until first call so non-server entry points
 * (scripts/, tests) don't open DB connections on module import.
 */
export function getDb(): Sql {
  if (_sql) return _sql;

  _sql = postgres({
    host: process.env['DB_HOST'] ?? 'localhost',
    port: Number(process.env['DB_PORT'] ?? 5432),
    database: process.env['DB_NAME'] ?? 'trade_tracker',
    username: process.env['DB_USER'] ?? 'postgres',
    password: process.env['DB_PASSWORD'] ?? 'postgres',
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    transform: postgres.camel, // snake_case columns → camelCase fields
  });

  return _sql;
}

export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
}
