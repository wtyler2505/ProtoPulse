import assert from 'node:assert/strict';
import sample from '../examples/sample-architecture.json';
import { validateArduinoCppFirmwareOutput } from '../src/ai/swarms/firmware-writer';

const output = validateArduinoCppFirmwareOutput(sample.firmwareOutput);

assert.equal(output.sketchName, 'mega_hid_profile');
assert.equal(output.board, 'Arduino Mega 2560 R3');
assert.ok(output.files.some((file) => file.path.endsWith('.ino')));

assert.throws(() => validateArduinoCppFirmwareOutput({
  sketchName: 'bad',
  board: 'Arduino Mega 2560 R3',
  files: [
    {
      path: 'bad.txt',
      language: 'cpp',
      content: 'not a sketch',
    },
  ],
}));

assert.throws(() => validateArduinoCppFirmwareOutput({
  sketchName: 'missing-sketch',
  board: 'Arduino Mega 2560 R3',
  files: [
    {
      path: 'helper.cpp',
      language: 'cpp',
      content: 'void helper() {}',
    },
  ],
}));

console.log(JSON.stringify({
  sketchName: output.sketchName,
  board: output.board,
  files: output.files.map((file) => file.path),
}, null, 2));
