import { describe, it, expect } from 'vitest';
import { formatArduinoCode } from '../code-formatter';
import type { FormatOptions } from '../code-formatter';

// ---------------------------------------------------------------------------
// Helper — trims leading/trailing whitespace from expected output for
// easier multi-line test authoring while preserving internal indentation.
// ---------------------------------------------------------------------------

function fmt(code: string, options?: FormatOptions): string {
  return formatArduinoCode(code, options);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('code-formatter', () => {
  // -----------------------------------------------------------------------
  // Basic indentation
  // -----------------------------------------------------------------------

  describe('indentation', () => {
    it('indents code inside braces (default 2 spaces)', () => {
      const input = `void setup() {
int x = 0;
Serial.begin(9600);
}`;
      const result = fmt(input);
      const lines = result.split('\n');
      expect(lines[0]).toBe('void setup() {');
      expect(lines[1]).toBe('  int x = 0;');
      expect(lines[2]).toBe('  Serial.begin(9600);');
      expect(lines[3]).toBe('}');
    });

    it('supports 4-space indentation', () => {
      const input = `void setup() {
int x = 0;
}`;
      const result = fmt(input, { indentWidth: 4 });
      const lines = result.split('\n');
      expect(lines[1]).toBe('    int x = 0;');
    });

    it('handles nested braces', () => {
      const input = `void loop() {
if (x) {
doSomething();
if (y) {
doMore();
}
}
}`;
      const result = fmt(input);
      const lines = result.split('\n');
      expect(lines[0]).toBe('void loop() {');
      expect(lines[1]).toBe('  if (x) {');
      expect(lines[2]).toBe('    doSomething();');
      expect(lines[3]).toBe('    if (y) {');
      expect(lines[4]).toBe('      doMore();');
      expect(lines[5]).toBe('    }');
      expect(lines[6]).toBe('  }');
      expect(lines[7]).toBe('}');
    });

    it('fixes incorrect indentation', () => {
      const input = `void setup() {
        int x = 0;
    int y = 1;
  Serial.begin(9600);
}`;
      const result = fmt(input);
      const lines = result.split('\n');
      expect(lines[1]).toBe('  int x = 0;');
      expect(lines[2]).toBe('  int y = 1;');
      expect(lines[3]).toBe('  Serial.begin(9600);');
    });

    it('handles else blocks', () => {
      const input = `if (a) {
doA();
} else {
doB();
}`;
      const result = fmt(input);
      const lines = result.split('\n');
      expect(lines[0]).toBe('if (a) {');
      expect(lines[1]).toBe('  doA();');
      expect(lines[2]).toBe('} else {');
      expect(lines[3]).toBe('  doB();');
      expect(lines[4]).toBe('}');
    });

    it('handles else if blocks', () => {
      const input = `if (a) {
doA();
} else if (b) {
doB();
} else {
doC();
}`;
      const result = fmt(input);
      const lines = result.split('\n');
      expect(lines[0]).toBe('if (a) {');
      expect(lines[1]).toBe('  doA();');
      expect(lines[2]).toBe('} else if (b) {');
      expect(lines[3]).toBe('  doB();');
      expect(lines[4]).toBe('} else {');
      expect(lines[5]).toBe('  doC();');
      expect(lines[6]).toBe('}');
    });
  });

  // -----------------------------------------------------------------------
  // Brace styles
  // -----------------------------------------------------------------------

  describe('brace styles', () => {
    it('K&R style (default) keeps opening brace on same line', () => {
      const input = `void setup() {
int x = 0;
}`;
      const result = fmt(input, { braceStyle: 'kr' });
      expect(result.split('\n')[0]).toBe('void setup() {');
    });

    it('Allman style puts opening brace on new line', () => {
      const input = `void setup() {
int x = 0;
}`;
      const result = fmt(input, { braceStyle: 'allman' });
      const lines = result.split('\n');
      expect(lines[0]).toBe('void setup()');
      expect(lines[1]).toBe('{');
      expect(lines[2]).toBe('  int x = 0;');
      expect(lines[3]).toBe('}');
    });

    it('Allman style splits "} else {" across lines', () => {
      const input = `if (a) {
doA();
} else {
doB();
}`;
      const result = fmt(input, { braceStyle: 'allman' });
      const lines = result.split('\n');
      expect(lines[0]).toBe('if (a)');
      expect(lines[1]).toBe('{');
      expect(lines[2]).toBe('  doA();');
      expect(lines[3]).toBe('}');
      expect(lines[4]).toBe('else');
      expect(lines[5]).toBe('{');
      expect(lines[6]).toBe('  doB();');
      expect(lines[7]).toBe('}');
    });
  });

  // -----------------------------------------------------------------------
  // Preprocessor directives
  // -----------------------------------------------------------------------

  describe('preprocessor directives', () => {
    it('keeps #include at column 0', () => {
      const input = `  #include <Arduino.h>
void setup() {
  #include "config.h"
}`;
      const result = fmt(input);
      const lines = result.split('\n');
      expect(lines[0]).toBe('#include <Arduino.h>');
      // #include inside braces also stays at col 0
      expect(lines[2]).toBe('#include "config.h"');
    });

    it('keeps #define at column 0', () => {
      const input = `  #define LED_PIN 13
  #define BAUD_RATE 9600`;
      const result = fmt(input);
      const lines = result.split('\n');
      expect(lines[0]).toBe('#define LED_PIN 13');
      expect(lines[1]).toBe('#define BAUD_RATE 9600');
    });

    it('keeps #ifdef/#endif at column 0', () => {
      const input = `  #ifdef DEBUG
  #define LOG(x) Serial.println(x)
  #else
  #define LOG(x)
  #endif`;
      const result = fmt(input);
      const lines = result.split('\n');
      expect(lines[0]).toBe('#ifdef DEBUG');
      expect(lines[4]).toBe('#endif');
    });

    it('handles #pragma at column 0', () => {
      const input = `  #pragma once`;
      const result = fmt(input);
      expect(result.trim()).toBe('#pragma once');
    });
  });

  // -----------------------------------------------------------------------
  // Operator spacing
  // -----------------------------------------------------------------------

  describe('operator spacing', () => {
    it('adds spaces around =', () => {
      const input = `void setup() {
int x=5;
}`;
      const result = fmt(input);
      expect(result).toContain('int x = 5;');
    });

    it('adds spaces around ==', () => {
      const input = `if(x==5) {}`;
      const result = fmt(input);
      expect(result).toContain('x == 5');
    });

    it('adds spaces around !=', () => {
      const input = `if(x!=5) {}`;
      const result = fmt(input);
      expect(result).toContain('x != 5');
    });

    it('adds spaces around +=', () => {
      const input = `void f() {
x+=5;
}`;
      const result = fmt(input);
      expect(result).toContain('x += 5');
    });

    it('adds spaces around &&', () => {
      const input = `if(a&&b) {}`;
      const result = fmt(input);
      expect(result).toContain('a && b');
    });

    it('adds spaces around ||', () => {
      const input = `if(a||b) {}`;
      const result = fmt(input);
      expect(result).toContain('a || b');
    });

    it('adds space after comma', () => {
      const input = `func(a,b,c);`;
      const result = fmt(input);
      expect(result).toContain('func(a, b, c)');
    });

    it('does not add space before comma', () => {
      const input = `func(a , b , c);`;
      const result = fmt(input);
      expect(result).toContain('func(a, b, c)');
    });
  });

  // -----------------------------------------------------------------------
  // String and comment preservation
  // -----------------------------------------------------------------------

  describe('string and comment preservation', () => {
    it('preserves string content', () => {
      const input = `void setup() {
Serial.println("Hello,   World!  x=5  a&&b");
}`;
      const result = fmt(input);
      expect(result).toContain('"Hello,   World!  x=5  a&&b"');
    });

    it('preserves single-quoted char literals', () => {
      const input = `void setup() {
char c = '\\n';
}`;
      const result = fmt(input);
      expect(result).toContain("'\\n'");
    });

    it('preserves line comments', () => {
      const input = `void setup() {
int x = 0; // this is  a  comment  x=5
}`;
      const result = fmt(input);
      expect(result).toContain('// this is  a  comment  x=5');
    });

    it('preserves block comments', () => {
      const input = `/* This is
a block comment
with  weird   spacing */
void setup() {}`;
      const result = fmt(input);
      expect(result).toContain('a block comment');
      expect(result).toContain('with  weird   spacing');
    });

    it('does not modify operators inside strings', () => {
      const input = `char* msg = "x=5,a!=b";`;
      const result = fmt(input);
      expect(result).toContain('"x=5,a!=b"');
    });
  });

  // -----------------------------------------------------------------------
  // Blank line normalization
  // -----------------------------------------------------------------------

  describe('blank line normalization', () => {
    it('limits consecutive blank lines to maxBlankLines (default 2)', () => {
      const input = `int a = 1;




int b = 2;`;
      const result = fmt(input);
      const lines = result.split('\n');
      // Count max consecutive blank lines
      let maxConsecutive = 0;
      let current = 0;
      for (const line of lines) {
        if (line.trim() === '') {
          current++;
          maxConsecutive = Math.max(maxConsecutive, current);
        } else {
          current = 0;
        }
      }
      expect(maxConsecutive).toBeLessThanOrEqual(2);
    });

    it('respects custom maxBlankLines setting', () => {
      const input = `int a = 1;




int b = 2;`;
      const result = fmt(input, { maxBlankLines: 1 });
      const lines = result.split('\n');
      let maxConsecutive = 0;
      let current = 0;
      for (const line of lines) {
        if (line.trim() === '') {
          current++;
          maxConsecutive = Math.max(maxConsecutive, current);
        } else {
          current = 0;
        }
      }
      expect(maxConsecutive).toBeLessThanOrEqual(1);
    });

    it('removes trailing blank lines', () => {
      const input = `int x = 0;


`;
      const result = fmt(input);
      // Should end with exactly one newline (no trailing blanks)
      expect(result.endsWith('\n')).toBe(true);
      expect(result.endsWith('\n\n')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Arduino-specific patterns
  // -----------------------------------------------------------------------

  describe('Arduino patterns', () => {
    it('formats a typical Arduino sketch', () => {
      const input = `#include <Arduino.h>
#define LED_PIN 13

void setup(){
pinMode(LED_PIN,OUTPUT);
Serial.begin(9600);
}

void loop(){
digitalWrite(LED_PIN,HIGH);
delay(1000);
digitalWrite(LED_PIN,LOW);
delay(1000);
}`;
      const result = fmt(input);
      const lines = result.split('\n');

      // Preprocessor at col 0
      expect(lines[0]).toBe('#include <Arduino.h>');
      expect(lines[1]).toBe('#define LED_PIN 13');

      // Indented function bodies
      expect(lines.some(l => l.startsWith('  pinMode'))).toBe(true);
      expect(lines.some(l => l.startsWith('  Serial.begin'))).toBe(true);
      expect(lines.some(l => l.startsWith('  digitalWrite'))).toBe(true);
      expect(lines.some(l => l.startsWith('  delay'))).toBe(true);
    });

    it('handles switch/case indentation', () => {
      const input = `void loop() {
switch (state) {
case 0:
doA();
break;
case 1:
doB();
break;
default:
doC();
break;
}
}`;
      const result = fmt(input);
      const lines = result.split('\n');
      // switch body should be indented
      expect(lines[1]).toBe('  switch (state) {');
      // case labels at switch level
      expect(lines[2]).toBe('    case 0:');
      expect(lines[3]).toBe('    doA();');
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty input', () => {
      const result = fmt('');
      expect(result).toBe('\n');
    });

    it('handles single-line input', () => {
      const result = fmt('int x = 0;');
      expect(result.trim()).toBe('int x = 0;');
    });

    it('preserves escaped quotes in strings', () => {
      const input = `char* s = "he said \\"hello\\"";`;
      const result = fmt(input);
      expect(result).toContain('"he said \\"hello\\""');
    });

    it('handles deeply nested braces', () => {
      const input = `void f() {
if (a) {
for (int i=0; i<10; i++) {
while (b) {
doSomething();
}
}
}
}`;
      const result = fmt(input);
      const lines = result.split('\n');
      // doSomething should be indented 4 levels = 8 spaces
      expect(lines[4]).toBe('        doSomething();');
    });

    it('handles brace on its own line', () => {
      const input = `void setup()
{
int x = 0;
}`;
      const result = fmt(input);
      const lines = result.split('\n');
      // In K&R, the standalone { gets its own line
      expect(lines[1]).toBe('{');
      expect(lines[2]).toBe('  int x = 0;');
    });

    it('ensures file ends with newline', () => {
      const input = 'int x = 0;';
      const result = fmt(input);
      expect(result.endsWith('\n')).toBe(true);
    });

    it('does not crash on unbalanced braces', () => {
      const input = `void setup() {
int x = 0;`;
      // Should not throw
      expect(() => fmt(input)).not.toThrow();
    });

    it('handles for-loop with semicolons', () => {
      const input = `void f() {
for(int i=0;i<10;i++) {
x++;
}
}`;
      const result = fmt(input);
      // Semicolons in for-loop should have spaces after them
      expect(result).toContain('; ');
    });

    it('handles struct/class definitions', () => {
      const input = `struct Point {
int x;
int y;
};`;
      const result = fmt(input);
      const lines = result.split('\n');
      expect(lines[1]).toBe('  int x;');
      expect(lines[2]).toBe('  int y;');
    });
  });
});
