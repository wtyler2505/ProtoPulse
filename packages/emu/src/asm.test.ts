import { describe, expect, it } from 'vitest';

import { BRNE, CBI, DEC, IN, LDI, LDS, NOP, OUT, RJMP, SBI, STS, assemble } from './asm.js';

// Expected words cross-checked against avr-gcc disassembly of the same
// mnemonics (e.g. `sbi 0x05, 5` → 0x9A2D, `rjmp .-2` → 0xCFFF).

describe('opcode encodings', () => {
  it('NOP is the all-zero word', () => {
    expect(NOP()).toBe(0x0000);
  });

  it('LDI encodes the immediate split around the register field', () => {
    expect(LDI(16, 0x20)).toBe(0xe200);
    expect(LDI(31, 0xff)).toBe(0xefff);
  });

  it('OUT splits the I/O address around the register field', () => {
    expect(OUT(0x04, 16)).toBe(0xb904); // out DDRB, r16
    expect(OUT(0x25, 16)).toBe(0xbd05); // out TCCR0B, r16
  });

  it('IN mirrors OUT with the direction bit clear', () => {
    expect(IN(17, 0x09)).toBe(0xb119); // in r17, PIND
  });

  it('SBI/CBI pack a 5-bit I/O address and 3-bit index', () => {
    expect(SBI(0x05, 5)).toBe(0x9a2d); // sbi PORTB, 5
    expect(CBI(0x05, 5)).toBe(0x982d); // cbi PORTB, 5
  });

  it('RJMP uses a 12-bit two’s-complement word offset', () => {
    expect(RJMP(-1)).toBe(0xcfff); // jump-to-self
    expect(RJMP(0)).toBe(0xc000); // jump to next instruction
  });

  it('DEC places the register in bits 8..4', () => {
    expect(DEC(17)).toBe(0x951a);
  });

  it('BRNE uses a 7-bit two’s-complement word offset', () => {
    expect(BRNE(-2)).toBe(0xf7f1); // brne .-4 (classic delay loop)
  });

  it('STS/LDS emit two words: opcode then raw data address', () => {
    expect(STS(0x00c6, 17)).toEqual([0x9310, 0x00c6]); // sts UDR0, r17
    expect(LDS(16, 0x00c0)).toEqual([0x9100, 0x00c0]); // lds r16, UCSR0A
  });

  it('rejects out-of-range operands', () => {
    expect(() => LDI(5, 0)).toThrow(/LDI register out of range/);
    expect(() => SBI(32, 0)).toThrow(/SBI I\/O address out of range/);
    expect(() => RJMP(2048)).toThrow(/RJMP offset out of range/);
    expect(() => BRNE(64)).toThrow(/BRNE offset out of range/);
  });
});

describe('assemble', () => {
  it('emits little-endian byte pairs, flattening two-word ops', () => {
    const bytes = assemble([SBI(0x05, 5), STS(0x00c6, 17)]);
    expect([...bytes]).toEqual([0x2d, 0x9a, 0x10, 0x93, 0xc6, 0x00]);
  });

  it('assembles an empty program to zero bytes', () => {
    expect(assemble([]).length).toBe(0);
  });
});
