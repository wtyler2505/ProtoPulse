/**
 * Provider abstraction — the agent loop talks to this, not to a vendor
 * SDK. AnthropicProvider adapts the real API; FakeProvider scripts turns
 * for tests. Non-streaming is fine for M1.
 */

export type AgentEvent =
  | { kind: 'text'; text: string }
  | { kind: 'tool_use'; id: string; name: string; input: unknown }
  | { kind: 'done'; stopReason: string };

export type ProviderContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export interface ProviderMessage {
  role: 'user' | 'assistant';
  content: string | ProviderContentBlock[];
}

/** Vendor-neutral tool spec; Anthropic.Tool satisfies it structurally. */
export interface ToolSpec {
  name: string;
  description?: string;
  input_schema: { type: 'object'; [k: string]: unknown };
}

export interface LlmTurn {
  system: string;
  messages: ProviderMessage[];
  tools: ToolSpec[];
}

export interface LlmProvider {
  turn(req: LlmTurn): Promise<AgentEvent[]>;
}
