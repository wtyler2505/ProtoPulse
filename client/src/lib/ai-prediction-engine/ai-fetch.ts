/**
 * AI (Gemini) enhancement layer. Builds the prompt describing the current
 * design, POSTs to `/api/chat/ai`, parses the response as a list of
 * Prediction objects. Failure is non-fatal — callers fall back to local
 * heuristic results.
 */

import type {
  Prediction,
  PredictionAction,
  PredictionBomItem,
  PredictionCategory,
  PredictionEdge,
  PredictionNode,
} from './types';

export interface AIFetchOptions {
  apiKey: string;
  projectId: number;
  sessionId: string;
}

/**
 * Build the Gemini prompt describing components, connections, and BOM.
 * Extracted so tests and callers can inspect the exact prompt.
 */
export function buildAIPrompt(
  nodes: PredictionNode[],
  edges: PredictionEdge[],
  bom: PredictionBomItem[],
): string {
  const nodesSummary = nodes.map((n) => `${n.label} (${n.type})`).join(', ');
  const edgesSummary = edges.map((e) => {
    const src = nodes.find((n) => n.id === e.source)?.label ?? e.source;
    const tgt = nodes.find((n) => n.id === e.target)?.label ?? e.target;
    return `${src} → ${tgt}${e.label ? ` [${e.label}]` : ''}`;
  }).join(', ');
  const bomSummary = bom.map((b) => `${b.partNumber} (${b.description}, qty ${String(b.quantity)})`).join(', ');

  return `You are an expert electronics design reviewer. Analyze this circuit design and suggest improvements the user might not have considered.

COMPONENTS: ${nodesSummary || '(none)'}
CONNECTIONS: ${edgesSummary || '(none)'}
BOM: ${bomSummary || '(none)'}

Return a JSON array of suggestions. Each suggestion must have:
- "title": short title (under 60 chars)
- "description": detailed explanation
- "category": one of "missing_component", "best_practice", "safety", "optimization", "learning_tip"
- "confidence": number 0.0-1.0
- "action_type": one of "add_component", "show_info", "open_view" (or null)
- "action_payload": object with relevant params (or null)

Focus on things a hobbyist might miss: thermal management, ESD protection, signal integrity, power sequencing, component derating. Only suggest things NOT already present in the design. Respond ONLY with valid JSON array.`;
}

/**
 * Call the server's chat-AI endpoint with the prediction prompt and parse
 * suggestions into Prediction objects. Returns an empty array if the
 * response can't be parsed as JSON.
 */
export async function fetchAIPredictions(
  nodes: PredictionNode[],
  edges: PredictionEdge[],
  bom: PredictionBomItem[],
  options: AIFetchOptions,
): Promise<Prediction[]> {
  const prompt = buildAIPrompt(nodes, edges, bom);

  const response = await fetch('/api/chat/ai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': options.sessionId,
    },
    body: JSON.stringify({
      message: prompt,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      apiKey: options.apiKey,
      projectId: options.projectId,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI prediction request failed: ${String(response.status)}`);
  }

  const data = await response.json() as { message?: string; actions?: unknown[] };
  const text = data.message ?? '';

  // Parse JSON from the response text
  let suggestions: Array<{
    title: string;
    description: string;
    category: string;
    confidence: number;
    action_type?: string | null;
    action_payload?: Record<string, unknown> | null;
  }>;

  try {
    // Try direct parse first
    suggestions = JSON.parse(text);
  } catch {
    // Try extracting from markdown fences
    const match = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
    if (match?.[1]) {
      suggestions = JSON.parse(match[1]);
    } else {
      return [];
    }
  }

  if (!Array.isArray(suggestions)) {
    return [];
  }

  const validCategories = new Set<string>(['missing_component', 'best_practice', 'safety', 'optimization', 'learning_tip']);

  return suggestions
    .filter((s) => typeof s.title === 'string' && typeof s.description === 'string')
    .map((s, i) => {
      const category = validCategories.has(s.category) ? s.category as PredictionCategory : 'best_practice' as PredictionCategory;
      const prediction: Prediction = {
        id: `ai-${String(Date.now())}-${String(i)}`,
        ruleId: `ai-generated-${String(i)}`,
        title: s.title.slice(0, 80),
        description: s.description,
        confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0.7,
        category,
        dismissed: false,
      };

      if (s.action_type && s.action_payload) {
        const actionType = s.action_type as PredictionAction['type'];
        if (['add_component', 'add_connection', 'modify_value', 'open_view', 'show_info'].includes(actionType)) {
          prediction.action = {
            type: actionType,
            payload: s.action_payload,
          };
        }
      }

      return prediction;
    });
}
