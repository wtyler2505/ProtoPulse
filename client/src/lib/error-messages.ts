/**
 * Error message mapping utility.
 *
 * Translates raw API errors (HTTP status codes, network failures, AI-specific
 * error patterns) into user-friendly messages with actionable guidance.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserFacingError {
  /** Short title for toast / heading. */
  title: string;
  /** Longer description with actionable guidance. */
  description: string;
  /** Whether the user can meaningfully retry the same action. */
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// HTTP status code map
// ---------------------------------------------------------------------------

const HTTP_STATUS_MAP: Record<number, UserFacingError> = {
  400: {
    title: 'Invalid request',
    description: 'The request was malformed. Please check your input and try again.',
    retryable: false,
  },
  401: {
    title: 'Session expired',
    description: 'Your session has expired. Please refresh the page to continue.',
    retryable: false,
  },
  403: {
    title: 'Permission denied',
    description: "You don't have permission for this action.",
    retryable: false,
  },
  404: {
    title: 'Not found',
    description: 'This item was not found. It may have been deleted or moved.',
    retryable: false,
  },
  409: {
    title: 'Conflict',
    description: 'This action conflicts with a recent change. Refresh and try again.',
    retryable: true,
  },
  413: {
    title: 'Content too large',
    description: 'The content is too large. Try shortening your message or reducing the file size.',
    retryable: false,
  },
  422: {
    title: 'Validation failed',
    description: 'The data provided is invalid. Please check the fields and try again.',
    retryable: false,
  },
  429: {
    title: 'Too many requests',
    description: 'You are sending requests too quickly. Please wait a moment and try again.',
    retryable: true,
  },
  500: {
    title: 'Server error',
    description: 'An unexpected server error occurred. Try again in a few seconds.',
    retryable: true,
  },
  502: {
    title: 'Service unavailable',
    description: 'The server is temporarily unreachable. Please try again shortly.',
    retryable: true,
  },
  503: {
    title: 'Service unavailable',
    description: 'The service is temporarily down for maintenance. Please try again shortly.',
    retryable: true,
  },
  504: {
    title: 'Request timed out',
    description: 'The server took too long to respond. Please try again.',
    retryable: true,
  },
};

// ---------------------------------------------------------------------------
// AI / streaming error patterns
// ---------------------------------------------------------------------------

interface ErrorPattern {
  test: (message: string) => boolean;
  error: UserFacingError;
}

const AI_ERROR_PATTERNS: ErrorPattern[] = [
  {
    test: (m) => /invalid.*(api[_ ]?key|token|auth)/i.test(m) || /authentication_error/i.test(m),
    error: {
      title: 'Invalid API key',
      description: 'Your AI API key is invalid or expired. Check your key in settings.',
      retryable: false,
    },
  },
  {
    test: (m) => /overloaded|capacity|rate_limit/i.test(m),
    error: {
      title: 'AI model overloaded',
      description: 'The AI model is at capacity. Wait a moment and try again, or switch to a different model in settings.',
      retryable: true,
    },
  },
  {
    test: (m) => /context.*(too long|length|limit|exceeded|window)/i.test(m) || /max.*tokens/i.test(m),
    error: {
      title: 'Context too long',
      description: 'The conversation is too long for the AI model. Start a new conversation or clear chat history.',
      retryable: false,
    },
  },
  {
    test: (m) => /content.*(filter|policy|moderation|blocked|safety)/i.test(m),
    error: {
      title: 'Content filtered',
      description: 'The request was blocked by the AI safety filter. Try rephrasing your message.',
      retryable: false,
    },
  },
  {
    test: (m) => /billing|quota|insufficient.*(fund|credit|balance)/i.test(m),
    error: {
      title: 'API billing issue',
      description: 'Your AI provider account may have insufficient credits. Check your billing settings.',
      retryable: false,
    },
  },
  {
    test: (m) => /model.*(not found|unavailable|does not exist|invalid)/i.test(m),
    error: {
      title: 'Model unavailable',
      description: 'The selected AI model is not available. Choose a different model in settings.',
      retryable: false,
    },
  },
];

// ---------------------------------------------------------------------------
// Network error detection
// ---------------------------------------------------------------------------

const NETWORK_ERROR: UserFacingError = {
  title: 'Connection lost',
  description: 'Unable to reach the server. Check your internet connection and try again.',
  retryable: true,
};

const TIMEOUT_ERROR: UserFacingError = {
  title: 'Request timed out',
  description: 'The request took too long to complete. Please try again.',
  retryable: true,
};

const ABORT_ERROR: UserFacingError = {
  title: 'Request cancelled',
  description: 'The request was cancelled.',
  retryable: true,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract an HTTP status code from an Error message produced by `throwIfResNotOk`
 * in queryClient.ts.  These messages follow the format "NNN: <body>".
 */
function extractStatusCode(message: string): number | null {
  const match = /^(\d{3}):\s/.exec(message);
  return match ? Number(match[1]) : null;
}

/**
 * Map an Error (from fetch, React Query, or SSE streaming) to a UserFacingError
 * with an actionable title + description.
 */
export function mapErrorToUserMessage(error: unknown): UserFacingError {
  if (!(error instanceof Error)) {
    return {
      title: 'Unknown error',
      description: String(error) || 'An unexpected error occurred.',
      retryable: true,
    };
  }

  // Abort / cancellation
  if (error.name === 'AbortError') {
    return ABORT_ERROR;
  }

  // Network failures (TypeError from fetch)
  if (error instanceof TypeError && /fetch|network|failed to fetch|load/i.test(error.message)) {
    return NETWORK_ERROR;
  }

  // Timeout patterns
  if (/timed?\s*out|timeout/i.test(error.message)) {
    return TIMEOUT_ERROR;
  }

  // HTTP status from our queryClient error format "NNN: body"
  const status = extractStatusCode(error.message);
  if (status !== null && HTTP_STATUS_MAP[status]) {
    return HTTP_STATUS_MAP[status];
  }

  // AI-specific error patterns (check the full message)
  for (const pattern of AI_ERROR_PATTERNS) {
    if (pattern.test(error.message)) {
      return pattern.error;
    }
  }

  // Generic network error heuristic (catch remaining connection issues)
  if (/network|ECONNREFUSED|ENOTFOUND|ERR_CONNECTION/i.test(error.message)) {
    return NETWORK_ERROR;
  }

  // Fallback: return the raw message wrapped in a generic shape
  return {
    title: 'Something went wrong',
    description: error.message || 'An unexpected error occurred. Please try again.',
    retryable: true,
  };
}

/**
 * Map an SSE streaming error event (the data payload from a `type: "error"` SSE
 * message) to a UserFacingError.  Streaming errors arrive as plain strings or
 * objects with a `message` field.
 */
export function mapStreamErrorToUserMessage(errorData: string | { message?: string; code?: string }): UserFacingError {
  const message = typeof errorData === 'string'
    ? errorData
    : errorData.message ?? 'Stream failed';

  // Build a synthetic Error so we can reuse the main mapper
  const syntheticError = new Error(message);

  // If there is an error code, check for known HTTP-like codes
  if (typeof errorData === 'object' && errorData.code) {
    const code = Number(errorData.code);
    if (!Number.isNaN(code) && HTTP_STATUS_MAP[code]) {
      return HTTP_STATUS_MAP[code];
    }
  }

  return mapErrorToUserMessage(syntheticError);
}
