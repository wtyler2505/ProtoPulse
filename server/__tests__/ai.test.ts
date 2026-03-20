import { describe, it, expect } from 'vitest';
import { parseActionsFromResponse, categorizeError, isRetryableError, getDefaultFallbackModel, redactSecrets } from '../ai';

// =============================================================================
// parseActionsFromResponse
// =============================================================================

describe('parseActionsFromResponse', () => {
  it('parses a fenced JSON block with a single action', () => {
    const input = `Here's the plan:\n\n\`\`\`json\n[{"type":"add_node","nodeType":"mcu","label":"ESP32"}]\n\`\`\``;
    const result = parseActionsFromResponse(input);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual({
      type: 'add_node',
      nodeType: 'mcu',
      label: 'ESP32',
    });
    expect(result.message).toBe("Here's the plan:");
  });

  it('parses a fenced JSON block with multiple actions', () => {
    const input = [
      'I will add two nodes.',
      '',
      '```json',
      '[',
      '  {"type":"add_node","nodeType":"mcu","label":"ESP32"},',
      '  {"type":"add_node","nodeType":"sensor","label":"BME280"}',
      ']',
      '```',
    ].join('\n');
    const result = parseActionsFromResponse(input);

    expect(result.actions).toHaveLength(2);
    expect(result.actions[0].type).toBe('add_node');
    expect(result.actions[1].type).toBe('add_node');
    expect(result.message).toBe('I will add two nodes.');
  });

  it('uses the LAST fenced JSON block when multiple exist', () => {
    const input = [
      '```json',
      '[{"type":"clear_canvas"}]',
      '```',
      'Actually, let me do this instead:',
      '```json',
      '[{"type":"add_node","nodeType":"mcu","label":"Final"}]',
      '```',
    ].join('\n');
    const result = parseActionsFromResponse(input);

    expect(result.actions).toHaveLength(1);
    const lastBlockAction = result.actions[0];
    expect(lastBlockAction.type).toBe('add_node');
    if (lastBlockAction.type === 'add_node') {
      expect(lastBlockAction.label).toBe('Final');
    }
    // Message is everything before the last match
    expect(result.message).toContain('Actually, let me do this instead:');
  });

  it('parses a bare JSON array at the end of text', () => {
    const input = `I'll add the node.\n[{"type":"add_node","label":"MCU","nodeType":"mcu"}]`;
    const result = parseActionsFromResponse(input);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('add_node');
    expect(result.message).toBe("I'll add the node.");
  });

  it('returns empty actions and full text as message when fenced JSON is malformed', () => {
    const input = `Here's the plan:\n\`\`\`json\n{invalid json\n\`\`\``;
    const result = parseActionsFromResponse(input);

    expect(result.actions).toHaveLength(0);
    expect(result.message).toBe(input.trim());
  });

  it('filters out objects missing the type field', () => {
    const input = [
      'Actions:',
      '```json',
      '[',
      '  {"type":"add_node","nodeType":"mcu","label":"ESP32"},',
      '  {"label":"no-type-field"},',
      '  {"type":"run_validation"}',
      ']',
      '```',
    ].join('\n');
    const result = parseActionsFromResponse(input);

    expect(result.actions).toHaveLength(2);
    expect(result.actions[0].type).toBe('add_node');
    expect(result.actions[1].type).toBe('run_validation');
  });

  it('returns empty actions and empty message for empty string', () => {
    const result = parseActionsFromResponse('');

    expect(result.actions).toHaveLength(0);
    expect(result.message).toBe('');
  });

  it('returns prose as message with no actions when text has no JSON', () => {
    const input = 'The ESP32 is a great choice for IoT projects. It supports Wi-Fi and BLE.';
    const result = parseActionsFromResponse(input);

    expect(result.actions).toHaveLength(0);
    expect(result.message).toBe(input);
  });

  it('splits prose before fenced block into message and parses actions', () => {
    const input = [
      'I recommend adding an MCU and a sensor to your design.',
      'Here is what I will do:',
      '',
      '```json',
      '[{"type":"add_node","nodeType":"mcu","label":"STM32F4"}]',
      '```',
    ].join('\n');
    const result = parseActionsFromResponse(input);

    expect(result.message).toBe(
      'I recommend adding an MCU and a sensor to your design.\nHere is what I will do:'
    );
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('add_node');
  });

  it('wraps a single action object (not array) in fenced block into an array', () => {
    const input = [
      'Renaming the project.',
      '```json',
      '{"type":"rename_project","name":"IoT Weather Station"}',
      '```',
    ].join('\n');
    const result = parseActionsFromResponse(input);

    expect(result.actions).toHaveLength(1);
    const renameAction = result.actions[0];
    expect(renameAction.type).toBe('rename_project');
    if (renameAction.type === 'rename_project') {
      expect(renameAction.name).toBe('IoT Weather Station');
    }
  });

  it('parses nested JSON objects with valid type field', () => {
    const input = [
      'Generating architecture.',
      '```json',
      '[{"type":"generate_architecture","components":[{"label":"MCU","nodeType":"mcu","description":"Main controller","positionX":300,"positionY":200}],"connections":[{"sourceLabel":"MCU","targetLabel":"Sensor","label":"I2C"}]}]',
      '```',
    ].join('\n');
    const result = parseActionsFromResponse(input);

    expect(result.actions).toHaveLength(1);
    const archAction = result.actions[0];
    expect(archAction.type).toBe('generate_architecture');
    if (archAction.type === 'generate_architecture') {
      expect(archAction.components).toHaveLength(1);
      expect(archAction.connections).toHaveLength(1);
    }
  });

  it('parses fenced block with extra whitespace and newlines', () => {
    const input = [
      'Adding node.',
      '',
      '```json',
      '',
      '  [  {"type":"run_validation"}  ]  ',
      '',
      '```',
    ].join('\n');
    const result = parseActionsFromResponse(input);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('run_validation');
  });
});

// =============================================================================
// categorizeError
// =============================================================================

describe('categorizeError', () => {
  it('categorizes status 401 as AUTH_FAILED', () => {
    const result = categorizeError({ status: 401, message: 'Unauthorized' });

    expect(result.code).toBe('AUTH_FAILED');
    expect(result.userMessage).toContain('API key');
  });

  it('categorizes status 429 as RATE_LIMITED', () => {
    const result = categorizeError({ status: 429, message: 'Too Many Requests' });

    expect(result.code).toBe('RATE_LIMITED');
    expect(result.userMessage).toContain('Rate limit');
  });

  it('categorizes status 500 as PROVIDER_ERROR', () => {
    const result = categorizeError({ status: 500, message: 'Internal Server Error' });

    expect(result.code).toBe('PROVIDER_ERROR');
    expect(result.userMessage).toContain('AI provider');
  });

  it('categorizes status 503 as PROVIDER_ERROR (any 5xx)', () => {
    const result = categorizeError({ status: 503, message: 'Service Unavailable' });

    expect(result.code).toBe('PROVIDER_ERROR');
  });

  it('categorizes message containing "timeout" as TIMEOUT', () => {
    const result = categorizeError({ message: 'Request timeout exceeded' });

    expect(result.code).toBe('TIMEOUT');
    expect(result.userMessage).toContain('timed out');
  });

  it('categorizes status 400 as MODEL_ERROR', () => {
    const result = categorizeError({ status: 400, message: 'Bad Request' });

    expect(result.code).toBe('MODEL_ERROR');
  });

  it('categorizes message containing "invalid_api_key" as AUTH_FAILED', () => {
    const result = categorizeError({ message: 'Error: invalid_api_key provided' });

    expect(result.code).toBe('AUTH_FAILED');
  });

  it('categorizes message containing "rate limit" as RATE_LIMITED', () => {
    const result = categorizeError({ message: 'You have exceeded your rate limit' });

    expect(result.code).toBe('RATE_LIMITED');
  });

  it('categorizes a plain string error as UNKNOWN', () => {
    const result = categorizeError('Something went wrong');

    expect(result.code).toBe('UNKNOWN');
    expect(result.userMessage).toContain('Something went wrong');
  });

  it('redacts Anthropic API keys (sk-...) in user message', () => {
    const result = categorizeError({
      message: 'Failed with key sk-ant1234567890abcdef in request',
    });

    expect(result.code).toBe('UNKNOWN');
    expect(result.userMessage).not.toContain('sk-ant1234567890abcdef');
    expect(result.userMessage).toContain('[REDACTED]');
  });

  it('redacts Google API keys (AIza...) in user message', () => {
    const result = categorizeError({
      message: 'Failed with key AIzaSyA1B2C3D4E5F6G7H8I9 in request',
    });

    expect(result.code).toBe('UNKNOWN');
    expect(result.userMessage).not.toContain('AIzaSyA1B2C3D4E5F6G7H8I9');
    expect(result.userMessage).toContain('[REDACTED]');
  });

  it('handles null error gracefully', () => {
    const result = categorizeError(null);

    expect(result.code).toBe('UNKNOWN');
    expect(result.userMessage).toBeDefined();
  });

  it('handles undefined error gracefully', () => {
    const result = categorizeError(undefined);

    expect(result.code).toBe('UNKNOWN');
    expect(result.userMessage).toBeDefined();
  });

  it('reads statusCode when status is absent', () => {
    const result = categorizeError({ statusCode: 429, message: 'Slow down' });

    expect(result.code).toBe('RATE_LIMITED');
  });

  it('categorizes ETIMEDOUT as TIMEOUT', () => {
    const result = categorizeError({ message: 'connect ETIMEDOUT 1.2.3.4:443' });

    expect(result.code).toBe('TIMEOUT');
  });

  it('categorizes message with "model not found" as MODEL_ERROR', () => {
    const result = categorizeError({ message: 'model not found: claude-99' });

    expect(result.code).toBe('MODEL_ERROR');
  });

  it('categorizes message with "quota" as RATE_LIMITED', () => {
    const result = categorizeError({ message: 'You exceeded your current quota' });

    expect(result.code).toBe('RATE_LIMITED');
  });
});

// =============================================================================
// isRetryableError
// =============================================================================

describe('isRetryableError', () => {
  it('returns true for 500 Internal Server Error', () => {
    expect(isRetryableError({ status: 500, message: 'Internal Server Error' })).toBe(true);
  });

  it('returns true for 502 Bad Gateway', () => {
    expect(isRetryableError({ status: 502, message: 'Bad Gateway' })).toBe(true);
  });

  it('returns true for 503 Service Unavailable', () => {
    expect(isRetryableError({ status: 503, message: 'Service Unavailable' })).toBe(true);
  });

  it('returns true for circuit breaker style errors (no HTTP status)', () => {
    const error = new Error('circuit breaker open for anthropic, retry after 15s');
    expect(isRetryableError(error)).toBe(true);
  });

  it('returns true for timeout errors (no HTTP status)', () => {
    expect(isRetryableError({ message: 'Request timeout exceeded' })).toBe(true);
  });

  it('returns true for ETIMEDOUT network errors', () => {
    expect(isRetryableError({ message: 'connect ETIMEDOUT 1.2.3.4:443' })).toBe(true);
  });

  it('returns true for ECONNREFUSED network errors', () => {
    expect(isRetryableError({ message: 'connect ECONNREFUSED 127.0.0.1:443' })).toBe(true);
  });

  it('returns true for unknown errors with no status', () => {
    expect(isRetryableError({ message: 'Something went wrong' })).toBe(true);
  });

  it('returns true for plain string errors', () => {
    expect(isRetryableError('network failure')).toBe(true);
  });

  it('returns true for null errors', () => {
    expect(isRetryableError(null)).toBe(true);
  });

  it('returns false for 400 Bad Request', () => {
    expect(isRetryableError({ status: 400, message: 'Bad Request' })).toBe(false);
  });

  it('returns false for 401 Unauthorized', () => {
    expect(isRetryableError({ status: 401, message: 'Unauthorized' })).toBe(false);
  });

  it('returns false for 403 Forbidden', () => {
    expect(isRetryableError({ status: 403, message: 'Forbidden' })).toBe(false);
  });

  it('returns false for 404 Not Found', () => {
    expect(isRetryableError({ status: 404, message: 'Not Found' })).toBe(false);
  });

  it('returns false for 429 Rate Limited', () => {
    expect(isRetryableError({ status: 429, message: 'Too Many Requests' })).toBe(false);
  });

  it('returns false for 422 Unprocessable Entity', () => {
    expect(isRetryableError({ status: 422, message: 'Unprocessable Entity' })).toBe(false);
  });
});

// =============================================================================
// getDefaultFallbackModel
// =============================================================================

describe('getDefaultFallbackModel', () => {
  it('returns the standard Gemini model for gemini fallback', () => {
    const model = getDefaultFallbackModel('gemini');
    expect(model).toBe('gemini-2.5-flash');
  });
});

// =============================================================================
// redactSecrets
// =============================================================================

describe('redactSecrets', () => {
  it('redacts Anthropic API keys (sk-...)', () => {
    const text = 'Failed with key sk-ant1234567890abcdef in request';
    expect(redactSecrets(text)).not.toContain('sk-ant1234567890abcdef');
    expect(redactSecrets(text)).toContain('[REDACTED]');
  });

  it('redacts Google API keys (AIza...)', () => {
    const text = 'Key AIzaSyA1B2C3D4E5F6G7H8I9 is invalid';
    expect(redactSecrets(text)).not.toContain('AIzaSyA1B2C3D4E5F6G7H8I9');
    expect(redactSecrets(text)).toContain('[REDACTED]');
  });

  it('redacts multiple keys in one string', () => {
    const text = 'Keys sk-abc123 and AIzaXYZ456 failed';
    const result = redactSecrets(text);
    expect(result).not.toContain('sk-abc123');
    expect(result).not.toContain('AIzaXYZ456');
    expect(result.match(/\[REDACTED\]/g)).toHaveLength(2);
  });

  it('returns text unchanged when no keys present', () => {
    const text = 'No keys here, just a normal error message';
    expect(redactSecrets(text)).toBe(text);
  });
});
