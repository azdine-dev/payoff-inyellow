/** The sync server, as the app talks to it. Every call carries the unlock code. */
import type { WireRecord, WireRecordIn } from './types';

export class SyncHttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    public retryAfter?: number,
  ) {
    super(`${status} ${code}`);
  }
}

/** No answer at all: offline, or the server can't be reached. */
export class SyncNetworkError extends Error {}

export function syncApi(baseUrl: string, code: string, fetchFn: typeof fetch) {
  async function call<T>(method: string, syncId: string, query = '', body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetchFn(`${baseUrl}/sync/${encodeURIComponent(syncId)}${query}`, {
        method,
        headers: { 'X-PIY-Code': code, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      });
    } catch {
      throw new SyncNetworkError('network');
    }
    if (!res.ok) {
      let error = 'error';
      try {
        error = ((await res.json()) as { error?: string }).error ?? error;
      } catch {
        /* not JSON */
      }
      const retry = Number(res.headers.get('Retry-After'));
      throw new SyncHttpError(res.status, error, Number.isFinite(retry) && retry > 0 ? retry : undefined);
    }
    return (await res.json()) as T;
  }

  return {
    get: (syncId: string, since: number, limit: number) =>
      call<{ records: WireRecordIn[]; seq: number; more: boolean }>('GET', syncId, `?since=${since}&limit=${limit}`),
    put: (syncId: string, records: WireRecord[]) => call<{ accepted: number; skipped: number; seq: number }>('PUT', syncId, '', { records }),
    remove: (syncId: string) => call<{ deleted: boolean }>('DELETE', syncId),
  };
}
