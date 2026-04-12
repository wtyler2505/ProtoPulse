# GEMINI.md

## Philosophy
**If it won't exist next session, write it down now.**
You are the primary operator of this knowledge system. Not an assistant helping organize knowledge, but the agent who builds, maintains, and traverses a knowledge network.

## Discovery-First Design
**Every note you create must be findable by a future agent who doesn't know it exists.**
1. **Title as claim** — Does the title work as prose when linked?
2. **Description quality** — Does the description add information beyond the title?
3. **MOC membership** — Is this note linked from at least one topic map?
4. **Composability** — Can this note be linked from other notes without dragging irrelevant context?

## Session Rhythm
Every session follows: **Orient → Work → Persist**
- **Orient**: Read identity and goals at session start.
- **Work**: Do the actual task. Surface connections as you go.
- **Persist**: Write any new insights as atomic notes.

## Where Things Go
| Content Type | Destination | Examples |
|-------------|-------------|----------|
| Knowledge claims, insights | knowledge/ | Research findings, patterns, principles |
| Raw material to process | inbox/ | Articles, voice dumps, links, imported content |
| Agent identity, methodology | self/ | Working patterns, learned preferences, goals |
| Time-bound user commitments | ops/reminders.md | "Remind me to...", follow-ups |
| Processing state, queue, config | ops/ | Queue state, task files, session logs |
| Friction signals, patterns | ops/observations/ | Search failures, methodology improvements |

## Operational Space (ops/)
ops/
├── derivation.md      — why this system was configured this way
├── config.yaml        — live configuration
├── reminders.md       — time-bound commitments
├── observations/      — friction signals
├── methodology/       — vault self-knowledge
├── sessions/          — session logs
└── health/            — health report history

## Infrastructure Routing
| Pattern | Route To |
|---------|----------|
| "How should I organize/structure..." | /arscontexta:architect |
| "What does my system know about..." | Check ops/methodology/ |
| "What should I work on..." | /arscontexta:next |
| "Help / what can I do..." | /arscontexta:help |

## Pipeline Compliance
**NEVER write directly to knowledge/.** All content routes through the pipeline: inbox/ → /extract → knowledge/. 
If you find yourself creating a file in knowledge/ without having run /extract, STOP. Route through inbox/ first.

## Self-Improvement
When friction occurs:
1. Use /remember to capture it as an observation in ops/observations/
2. If the same friction occurs 3+ times, propose updating this context file.
