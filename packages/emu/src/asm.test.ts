import { describe, expect, it } from 'vitest';

import {
  ANDI,
  BRLO,
  BRNE,
  BRSH,
  CBI,
  CPI,
  DEC,
  IN,
  LDI,
  LDS,
  NOP,
  ORI,
  OUT,
  RJMP,
  SBI,
  SBRC,
  SBRS,
  STS,
  assemble,
} from './asm.js';

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

  it('ORI/ANDI/CPI share the LDI-style immediate split with their own prefixes', () => {
    expect(ORI(16, 0x40)).toBe(0x6400); // ori r16, 0x40
    expect(ANDI(17, 0x0f)).toBe(0x701f); // andi r17, 0x0F
    expect(CPI(19, 0x80)).toBe(0x3830); // cpi r19, 0x80
    expect(CPI(16, 0x00)).toBe(0x3000); // cpi r16, 0
  });

  it('SBRC/SBRS pack register and bit with the skip-direction bit', () => {
    expect(SBRC(17, 6)).toBe(0xfd16); // sbrc r17, 6
    expect(SBRS(17, 6)).toBe(0xff16); // sbrs r17, 6
  });

  it('BRLO/BRSH are BRBS/BRBC on the carry flag (SREG bit 0)', () => {
    expect(BRLO(-2)).toBe(0xf3f0); // brlo .-4
    expect(BRLO(0)).toBe(0xf000); // brlo .+0
    expect(BRSH(1)).toBe(0xf408); // brsh .+2
  });

  it('rejects out-of-range operands on the new opcodes', () => {
    expect(() => ORI(5, 0)).toThrow(/ORI register out of range/);
    expect(() => ANDI(16, 256)).toThrow(/ANDI constant out of range/);
    expect(() => CPI(15, 0)).toThrow(/CPI register out of range/);
    expect(() => SBRC(32, 0)).toThrow(/SBRC register out of range/);
    expect(() => SBRS(0, 8)).toThrow(/SBRS bit out of range/);
    expect(() => BRLO(64)).toThrow(/BRLO offset out of range/);
    expect(() => BRSH(-65)).toThrow(/BRSH offset out of range/);
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
