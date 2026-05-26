const MAX_ENTRIES = 100;

export interface RequestLogEntry {
  id: number;
  ts: string;
  method: string;
  url: string;
  statusCode: number;
  responseTimeMs: number;
}

let seq = 0;
const ring: RequestLogEntry[] = [];

export function logRequest(entry: Omit<RequestLogEntry, 'id' | 'ts'>): void {
  ring.push({ id: ++seq, ts: new Date().toISOString(), ...entry });
  if (ring.length > MAX_ENTRIES) ring.shift();
}

export function getRecentLogs(limit = 50): RequestLogEntry[] {
  return ring.slice(-limit).reverse();
}

export function clearLogs(): void {
  ring.length = 0;
}
