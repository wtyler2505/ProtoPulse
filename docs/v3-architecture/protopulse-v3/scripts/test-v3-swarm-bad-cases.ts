import assert from 'node:assert/strict';
import badSample from '../examples/sample-swarm-bad.json';
import readySample from '../examples/sample-swarm-ready.json';
import { planSwarmDispatch } from '../src/ai/swarms/orchestrator';

const badPlan = planSwarmDispatch(badSample.tasks);

assert.equal(badPlan.status, 'blocked');
assert.equal(badPlan.workerCap, 6);
assert.ok(badPlan.blockedReasons.includes('Too many workers: 7/6'));
assert.ok(badPlan.blockedReasons.includes('unsafe-root claims unsafe file path: /tmp/owned.ts'));
assert.ok(badPlan.blockedReasons.includes('unsafe-parent claims unsafe file path: ../server/genkit.ts'));
assert.ok(badPlan.blockedReasons.includes('duplicate-b conflicts with duplicate-a on src/hardware/fact-gate.ts'));

const readyPlan = planSwarmDispatch(readySample.tasks);

assert.equal(readyPlan.status, 'ready');
assert.deepEqual(readyPlan.blockedReasons, []);

console.log(JSON.stringify({
  badPlan: badPlan.status,
  badReasons: badPlan.blockedReasons,
  readyPlan: readyPlan.status,
  workerCap: badPlan.workerCap,
}, null, 2));
