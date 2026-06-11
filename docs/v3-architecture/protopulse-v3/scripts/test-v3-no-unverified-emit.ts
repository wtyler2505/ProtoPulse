import assert from 'node:assert/strict';
import sample from '../examples/sample-architecture.json';
import { extractBoundariesFromTldrawShapes } from '../src/components/canvas/CanvasBindings';
import { evaluateBoundaryRules } from '../src/components/canvas/BoundaryRules';
import {
  compileCanvasBoundariesToTscircuit,
  emitVerifiedTscircuitTsx,
  getNoEmitReasons,
} from '../src/components/circuits/SchematicCompiler';
import { checkHardwareFacts } from '../src/hardware/fact-gate';

const boundaries = extractBoundariesFromTldrawShapes(sample.tldrawShapes);
const ruleResults = evaluateBoundaryRules(boundaries);
const blockedCompile = compileCanvasBoundariesToTscircuit(boundaries, ruleResults);

assert.equal(blockedCompile.status, 'blocked');
assert.equal(emitVerifiedTscircuitTsx(blockedCompile), undefined);
assert.deepEqual(getNoEmitReasons(blockedCompile), ['hid-firmware missing metadata: ownedPins']);

const readyBoundaries = boundaries.filter((boundary) => boundary.id !== 'hid-firmware');
const readyRuleResults = evaluateBoundaryRules(readyBoundaries);
const readyCompile = compileCanvasBoundariesToTscircuit(readyBoundaries, readyRuleResults);
const emittedTsx = emitVerifiedTscircuitTsx(readyCompile);

assert.equal(readyCompile.status, 'ready');
assert.equal(typeof emittedTsx, 'string');
assert.match(emittedTsx ?? '', /<board/);

const unverifiedFacts = checkHardwareFacts({
  partNumber: 'Arduino Mega 2560 R3',
  requiredFacts: ['pinout'],
  knownFacts: {
    pinout: {
      value: '54 digital IO pins',
      source: 'draft user memory',
      status: 'needs_verification',
    },
  },
});

assert.equal(unverifiedFacts.status, 'needs_verification');
assert.deepEqual(unverifiedFacts.missingFacts, ['pinout']);

console.log(JSON.stringify({
  blockedCompile: blockedCompile.status,
  blockedTsxEmitted: Boolean(emitVerifiedTscircuitTsx(blockedCompile)),
  readyCompile: readyCompile.status,
  readyTsxEmitted: Boolean(emittedTsx),
  unverifiedFactGate: unverifiedFacts.status,
}, null, 2));
