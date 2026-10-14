export type PublicFetchFailureReason = 'http' | 'network' | 'invalid-json';

export type PublicFetchResult<T> =
  | {
      state: 'ok';
      data: T;
      status: number;
      requestId?: string;
    }
  | {
      state: 'not-found';
      status: 404;
      requestId?: string;
    }
  | {
      state: 'error';
      status?: number;
      requestId?: string;
      reason: PublicFetchFailureReason;
    };

function requestIdFrom(response: Response): string | undefined {
  return response.headers.get('x-request-id') || response.headers.get('request-id') || undefined;
}

export function invalidPublicPayload<T>(result: Extract<PublicFetchResult<unknown>, { state: 'ok' }>): PublicFetchResult<T> {
  return {
    state: 'error',
    status: result.status,
    requestId: result.requestId,
    reason: 'invalid-json',
  };
}

export async function fetchPublicJson<T>(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<PublicFetchResult<T>> {
  let response: Response;

  try {
    response = await fetch(input, init);
  } catch {
    return { state: 'error', reason: 'network' };
  }

  const requestId = requestIdFrom(response);
  if (response.status === 404) {
    return { state: 'not-found', status: 404, requestId };
  }
  if (!response.ok) {
    return { state: 'error', status: response.status, requestId, reason: 'http' };
  }

  try {
    return {
      state: 'ok',
      data: (await response.json()) as T,
      status: response.status,
      requestId,
    };
  } catch {
    return { state: 'error', status: response.status, requestId, reason: 'invalid-json' };
  }
}
