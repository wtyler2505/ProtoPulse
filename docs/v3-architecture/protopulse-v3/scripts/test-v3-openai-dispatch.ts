import assert from 'node:assert/strict';
import blockedSample from '../examples/sample-swarm.json';
import readySample from '../examples/sample-swarm-ready.json';
import { dispatchOpenAIAgents, planOpenAIAgentDispatch } from '../src/ai/swarms/openai-agents-dispatch';
import { planSwarmDispatch } from '../src/ai/swarms/orchestrator';

const blockedPlan = planSwarmDispatch(blockedSample.tasks);
const blockedDispatch = planOpenAIAgentDispatch(blockedPlan);

assert.equal(blockedPlan.status, 'blocked');
assert.equal(blockedDispatch.status, 'blocked');
assert.deepEqual(blockedDispatch.dispatches, []);

const readyPlan = planSwarmDispatch(readySample.tasks);
const dryRunDispatch = await dispatchOpenAIAgents(readyPlan);

assert.equal(readyPlan.status, 'ready');
assert.equal(dryRunDispatch.status, 'ready');
assert.equal(dryRunDispatch.mode, 'dry-run');
assert.equal(dryRunDispatch.dispatches.length, readyPlan.tasks.length);
assert.match(dryRunDispatch.dispatches[0].agentName, /^protopulse-v3-/);

console.log(JSON.stringify({
  blockedDispatch: blockedDispatch.status,
  blockedDispatchCount: blockedDispatch.dispatches.length,
  readyDispatch: dryRunDispatch.status,
  readyDispatchCount: dryRunDispatch.dispatches.length,
}, null, 2));
