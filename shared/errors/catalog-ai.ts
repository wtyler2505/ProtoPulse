/**
 * 6xxx — AI & Agent error catalog entries.
 */

import { ErrorCode } from './error-codes';
import { ErrorSeverity } from './error-types';
import type { ErrorCatalogEntry } from './error-types';

export const aiCatalog: Partial<Record<ErrorCode, ErrorCatalogEntry>> = {
  [ErrorCode.AI_PROVIDER_ERROR]: {
    code: ErrorCode.AI_PROVIDER_ERROR,
    httpStatus: 502,
    severity: ErrorSeverity.ERROR,
    label: 'AI provider error',
    description: 'The upstream AI provider (Anthropic/Google) returned an error.',
    retryable: true,
  },
  [ErrorCode.AI_CIRCUIT_BREAKER_OPEN]: {
    code: ErrorCode.AI_CIRCUIT_BREAKER_OPEN,
    httpStatus: 503,
    severity: ErrorSeverity.WARNING,
    label: 'AI temporarily unavailable',
    description: 'Circuit breaker is open due to repeated provider failures. Will retry after cooldown.',
    retryable: true,
  },
  [ErrorCode.AI_RESPONSE_INVALID]: {
    code: ErrorCode.AI_RESPONSE_INVALID,
    httpStatus: 422,
    severity: ErrorSeverity.ERROR,
    label: 'Invalid AI response',
    description: 'The AI model returned a response that could not be parsed as valid JSON.',
    retryable: true,
  },
  [ErrorCode.AI_ACTION_UNKNOWN]: {
    code: ErrorCode.AI_ACTION_UNKNOWN,
    httpStatus: 400,
    severity: ErrorSeverity.WARNING,
    label: 'Unknown AI action',
    description: 'The AI action type is not recognized by the action parser.',
    retryable: false,
  },
  [ErrorCode.AI_TOOL_FAILED]: {
    code: ErrorCode.AI_TOOL_FAILED,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'AI tool execution failed',
    description: 'An AI tool invocation failed during execution.',
    retryable: true,
  },
  [ErrorCode.AI_TOOL_CONFIRMATION_REQUIRED]: {
    code: ErrorCode.AI_TOOL_CONFIRMATION_REQUIRED,
    httpStatus: 200,
    severity: ErrorSeverity.INFO,
    label: 'Tool confirmation required',
    description: 'The AI tool requires explicit user confirmation before execution.',
    retryable: false,
  },
  [ErrorCode.AI_AGENT_MAX_STEPS]: {
    code: ErrorCode.AI_AGENT_MAX_STEPS,
    httpStatus: 200,
    severity: ErrorSeverity.WARNING,
    label: 'Agent max steps reached',
    description: 'The agentic AI loop reached the maximum allowed step count.',
    retryable: false,
  },
  [ErrorCode.AI_AGENT_RATE_LIMITED]: {
    code: ErrorCode.AI_AGENT_RATE_LIMITED,
    httpStatus: 429,
    severity: ErrorSeverity.WARNING,
    label: 'Agent rate limited',
    description: 'Design agent requests exceeded the per-minute rate limit.',
    retryable: true,
  },
  [ErrorCode.AI_MODEL_UNAVAILABLE]: {
    code: ErrorCode.AI_MODEL_UNAVAILABLE,
    httpStatus: 503,
    severity: ErrorSeverity.ERROR,
    label: 'AI model unavailable',
    description: 'The requested AI model is not available or is misconfigured.',
    retryable: true,
  },
  [ErrorCode.AI_LOW_CONFIDENCE]: {
    code: ErrorCode.AI_LOW_CONFIDENCE,
    httpStatus: 200,
    severity: ErrorSeverity.INFO,
    label: 'Low AI confidence',
    description: 'The AI confidence score is below the auto-apply threshold.',
    retryable: false,
  },
  [ErrorCode.AI_VISION_FAILED]: {
    code: ErrorCode.AI_VISION_FAILED,
    httpStatus: 422,
    severity: ErrorSeverity.ERROR,
    label: 'Vision recognition failed',
    description: 'Component image recognition could not identify the part.',
    retryable: true,
  },
  [ErrorCode.AI_GENERATIVE_FAILED]: {
    code: ErrorCode.AI_GENERATIVE_FAILED,
    httpStatus: 422,
    severity: ErrorSeverity.ERROR,
    label: 'Generative design failed',
    description: 'Generative design optimization failed to produce viable candidates.',
    retryable: true,
  },
  [ErrorCode.AI_STREAM_INTERRUPTED]: {
    code: ErrorCode.AI_STREAM_INTERRUPTED,
    httpStatus: 502,
    severity: ErrorSeverity.WARNING,
    label: 'AI stream interrupted',
    description: 'The SSE streaming connection to the AI provider was interrupted.',
    retryable: true,
  },
};
