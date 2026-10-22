import type { ApiFailure, ErrorCode } from '../../shared/contracts';

export type ClientErrorCode = ErrorCode | 'NETWORK' | 'TIMEOUT' | 'BAD_RESPONSE';

export class ApiError extends Error {
  readonly code: ClientErrorCode;
  readonly retryable: boolean;
  readonly status: number | null;
  readonly requestId: string | null;

  constructor(
    code: ClientErrorCode,
    message: string,
    opts: { retryable?: boolean; status?: number | null; requestId?: string | null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = opts.retryable ?? false;
    this.status = opts.status ?? null;
    this.requestId = opts.requestId ?? null;
  }
}

const STATUS_CODES: Record<number, ErrorCode> = {
  400: 'BAD_INPUT',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  410: 'EXPIRED',
  429: 'RATE_LIMITED',
  503: 'PROVIDER_UNAVAILABLE',
};

const ERROR_CODES: ErrorCode[] = [
  'BAD_INPUT', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'EXPIRED', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE',
];

export function isApiFailure(body: unknown): body is ApiFailure {
  if (typeof body !== 'object' || body === null) return false;
  const err = (body as { error?: unknown }).error;
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: unknown; message?: unknown };
  return typeof e.code === 'string' && typeof e.message === 'string';
}

/** Build an ApiError from a non-2xx response. The HTTP status wins if the body is not a valid envelope. */
export function errorFromResponse(status: number, body: unknown): ApiError {
  if (isApiFailure(body)) {
    const code = (ERROR_CODES as string[]).includes(body.error.code)
      ? body.error.code
      : (STATUS_CODES[status] ?? 'BAD_RESPONSE');
    return new ApiError(code, body.error.message, {
      retryable: Boolean(body.error.retryable),
      status,
      requestId: typeof body.requestId === 'string' ? body.requestId : null,
    });
  }
  const code = STATUS_CODES[status] ?? 'BAD_RESPONSE';
  return new ApiError(code, `Request failed (${status})`, { status, retryable: status === 429 || status === 503 });
}

export function isAbort(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: unknown }).name === 'AbortError';
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  return new ApiError('BAD_RESPONSE', e instanceof Error ? e.message : 'Unexpected error');
}

/**
 * True when a failed mutation may still have reached the server. Retrying blindly could duplicate it,
 * so callers should reconcile (re-read) before offering another attempt.
 */
export function isAmbiguous(e: unknown): boolean {
  return e instanceof ApiError && (e.code === 'NETWORK' || e.code === 'TIMEOUT' || e.code === 'BAD_RESPONSE');
}

export type ErrorSubject = 'search' | 'circle' | 'invitation' | 'generic';

export function messageFor(e: ApiError, subject: ErrorSubject = 'generic'): string {
  switch (e.code) {
    case 'UNAUTHENTICATED':
      return 'Your session has expired. Sign in again to continue.';
    case 'FORBIDDEN':
      return 'You don’t have access to this.';
    case 'NOT_FOUND':
      if (subject === 'search') return 'We couldn’t find that search. It may have expired.';
      if (subject === 'circle') return 'We couldn’t find that circle.';
      if (subject === 'invitation') return 'This invitation link isn’t valid.';
      return 'We couldn’t find that.';
    case 'EXPIRED':
      if (subject === 'search') return 'That search has expired. Run it again from Discover.';
      return 'This invitation has expired or was withdrawn. Ask the host for a new one.';
    case 'CONFLICT':
      return e.message || 'That is no longer possible. The circle may be full or have changed.';
    case 'RATE_LIMITED':
      return 'Too many requests. Wait a moment and try again.';
    case 'PROVIDER_UNAVAILABLE':
      return 'The service is temporarily unavailable. Try again shortly.';
    case 'NETWORK':
      return 'Couldn’t reach the server. Check your connection and try again.';
    case 'TIMEOUT':
      return 'The server took too long to respond.';
    case 'BAD_INPUT':
      return e.message || 'Some details need fixing.';
    default:
      return 'The server sent something unexpected.';
  }
}
