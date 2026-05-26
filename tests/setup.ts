// Global test environment bootstrap — runs before any module is imported.
// Modules that read env vars at import time (MEMORY_MODE, JWT_SECRET) rely on
// these being set before the first import. Individual test files may override.
process.env['JWT_SECRET'] ??= 'test-jwt-secret-minimum-16-chars!!';
process.env['MEMORY_MODE'] ??= 'true';
process.env['MARKET_DATA_PROVIDER'] ??= 'mock';
process.env['NODE_ENV'] ??= 'test';
