import type { AgentEvent, LlmProvider, LlmTurn } from './provider.js';

/**
 * Scripted provider for tests: returns successive pre-baked turns and
 * records every request it received for assertions. No network, ever.
 */
export class FakeProvider implements LlmProvider {
  /** Every LlmTurn the agent sent, in order. */
  readonly turns: LlmTurn[] = [];
  private cursor = 0;

  constructor(private scripted: AgentEvent[][]) {}

  turn(req: LlmTurn): Promise<AgentEvent[]> {
    this.turns.push(req);
    const events = this.scripted[this.cursor];
    this.cursor += 1;
    if (!events) {
      return Promise.resolve([{ kind: 'done', stopReason: 'end_turn' }]);
    }
    return Promise.resolve(events);
  }
}
