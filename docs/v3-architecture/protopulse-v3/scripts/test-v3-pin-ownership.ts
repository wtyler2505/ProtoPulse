import assert from 'node:assert/strict';
import sample from '../examples/sample-architecture.json';
import { checkPinOwnershipBeforeFirmware } from '../src/ai/swarms/firmware-writer';

const blocked = checkPinOwnershipBeforeFirmware(sample.firmwareRequest, ['pinout']);

assert.equal(blocked.status, 'blocked');
assert.ok(blocked.blockedReasons.includes('at least one owned pin is required before firmware generation'));

const missingPinout = checkPinOwnershipBeforeFirmware({
  board: 'Arduino Mega 2560 R3',
  ownedPins: ['D2'],
  behavior: 'blink LED',
}, []);

assert.equal(missingPinout.status, 'blocked');
assert.ok(missingPinout.blockedReasons.includes('pinout must be verified before firmware generation'));

const duplicatePins = checkPinOwnershipBeforeFirmware({
  board: 'Arduino Mega 2560 R3',
  ownedPins: ['D2', 'D2'],
  behavior: 'blink LED',
}, ['pinout']);

assert.equal(duplicatePins.status, 'blocked');
assert.ok(duplicatePins.blockedReasons.includes('duplicate owned pins: D2'));

const ready = checkPinOwnershipBeforeFirmware({
  board: 'Arduino Mega 2560 R3',
  ownedPins: ['D2', 'D3'],
  behavior: 'blink LED',
}, ['pinout']);

assert.equal(ready.status, 'ready');
assert.deepEqual(ready.blockedReasons, []);

console.log(JSON.stringify({
  blocked: blocked.status,
  missingPinout: missingPinout.status,
  duplicatePins: duplicatePins.status,
  ready: ready.status,
}, null, 2));
