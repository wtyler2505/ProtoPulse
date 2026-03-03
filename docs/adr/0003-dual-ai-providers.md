# ADR-0003: Dual AI Providers (Claude + Gemini)

**Status:** Accepted
**Date:** 2026-02-01 (retroactive)
**Deciders:** Tyler

## Context

ProtoPulse uses AI to generate architectures, suggest components, analyze designs, and assist users via chat. Relying on a single AI provider creates availability and capability risks.

## Decision

Support both Anthropic Claude and Google Gemini as AI providers with multi-model routing. Users can configure their preferred provider and API keys. The system routes requests to the appropriate model based on task complexity and user settings.

## Rationale

- **Availability**: If one provider has an outage, the other can serve as fallback.
- **Cost optimization**: Simpler tasks can route to less expensive models.
- **Capability matching**: Claude excels at complex multi-step actions; Gemini offers different strengths for certain tasks.
- **User choice**: Hardware engineers may have organizational preferences or existing API key subscriptions.

## Implementation

- `server/ai.ts` contains `routeToModel()` which selects the provider based on user settings and task type.
- Both providers use SSE streaming with unified response parsing.
- 53+ action types are provider-agnostic — defined in `server/ai-tools.ts` with Zod schemas that convert to either Anthropic or Gemini tool format.
- API keys stored encrypted (AES-256-GCM) per user in the database.

## Consequences

- **Two SDK dependencies**: `@anthropic-ai/sdk` and `@google/genai` both in the bundle.
- **Prompt compatibility**: System prompts must work well with both models — occasional model-specific tuning needed.
- **Testing complexity**: AI integration tests should cover both providers.
