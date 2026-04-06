---
description: "Voice workflow uses Levenshtein fuzzy-match against a static command array — complex spoken prompts are silently ignored instead of reaching the LLM"
type: debt-note
source: "conductor/comprehensive-audit.md §38"
confidence: proven
topics: ["[[architecture-decisions]]", "[[maker-ux]]"]
related_components: ["client/src/lib/voice-workflow.ts", "client/src/lib/voice-ai.ts"]
---

# Voice AI is a fake — it fuzzy-matches against a hardcoded command array instead of routing to the LLM

The "Voice AI" is completely disconnected from the actual Genkit LLM. `voice-workflow.ts` takes a transcribed string and uses a Levenshtein distance algorithm to fuzzy-match against a static array of `BUILT_IN_VOICE_COMMANDS` (e.g., "zoom in", "compile code"). Complex spoken prompts like "Hey AI, why is my resistor smoking?" are silently ignored because they don't match the hardcoded array.

Additionally, `voice-ai.ts` uses the deprecated `ScriptProcessorNode` API which forces all audio processing onto the main thread (20-50ms latency, glitches during React renders). Should use `AudioWorklet` (2.6ms latency, dedicated thread).

The speech recognition itself uses `webkitSpeechRecognition` — Chrome/Edge only, silently streams raw audio to Google/Microsoft cloud servers (privacy violation for proprietary circuit design).

---

Relevant Notes:
- [[ai-is-the-moat-lean-into-it]] -- voice is a natural AI interface but the current implementation is fake
- [[zero-form-elements-means-no-native-input-paradigm]] -- voice could be the input paradigm
- [[ai-toolset-has-major-blindspots-in-history-variables-lifecycle-and-zones]] -- voice is another AI capability disconnect: it can't reach the LLM, and the LLM can't reach 6 domains
- [[genkit-125-flat-tools-is-an-outdated-anti-pattern-needs-multi-agent]] -- voice should be a natural-language entry point to a multi-agent router
- [[beginners-need-ai-that-catches-mistakes-before-money-is-spent]] -- voice-as-AI is the most accessible input for beginners who don't know what to type

Topics:
- [[architecture-decisions]]
