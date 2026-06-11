/**
 * Tiny hand-assembler — test infrastructure, exported on purpose.
 *
 * Just enough AVR opcodes to write the firmware the emu tests need
 * (blink loops, busy-wait delays, UART pokes) without shipping a
 * compiled binary in the repo. This is NOT a general assembler: no
 * labels, no expressions — branch/jump offsets are given in words,
 * relative to the next instruction, exactly as the hardware encodes.
 *
 * Encodings transcribed from the AVR Instruction Set Manual
 * (Microchip DS40002198; same encodings as the classic Atmel doc 0856).
 * Each builder's comment shows the manual's bit layout.
 */

function assertRange(value: number, min: number, max: number, what: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${what} out of range: ${value} (expected ${min}..${max})`);
  }
}

/** NOP — 0000 0000 0000 0000. 1 cycle. */
export function NOP(): number {
  return 0x0000;
}

/** LDI Rd,K (16 ≤ d ≤ 31) — 1110 KKKK dddd KKKK. 1 cycle. */
export function LDI(d: number, k: number): number {
  assertRange(d, 16, 31, 'LDI register');
  assertRange(k, 0, 0xff, 'LDI constant');
  return 0xe000 | ((k & 0xf0) << 4) | ((d - 16) << 4) | (k & 0x0f);
}

/** OUT A,Rr (0 ≤ A ≤ 63, I/O-space address) — 1011 1AAr rrrr AAAA. 1 cycle. */
export function OUT(a: number, r: number): number {
  assertRange(a, 0, 63, 'OUT I/O address');
  assertRange(r, 0, 31, 'OUT register');
  return 0xb800 | ((a & 0x30) << 5) | (r << 4) | (a & 0x0f);
}

/** IN Rd,A (0 ≤ A ≤ 63, I/O-space address) — 1011 0AAd dddd AAAA. 1 cycle. */
export function IN(d: number, a: number): number {
  assertRange(a, 0, 63, 'IN I/O address');
  assertRange(d, 0, 31, 'IN register');
  return 0xb000 | ((a & 0x30) << 5) | (d << 4) | (a & 0x0f);
}

/** SBI A,b (0 ≤ A ≤ 31, I/O-space address) — 1001 1010 AAAA Abbb. 2 cycles. */
export function SBI(a: number, b: number): number {
  assertRange(a, 0, 31, 'SBI I/O address');
  assertRange(b, 0, 7, 'SBI bit');
  return 0x9a00 | (a << 3) | b;
}

/** CBI A,b (0 ≤ A ≤ 31, I/O-space address) — 1001 1000 AAAA Abbb. 2 cycles. */
export function CBI(a: number, b: number): number {
  assertRange(a, 0, 31, 'CBI I/O address');
  assertRange(b, 0, 7, 'CBI bit');
  return 0x9800 | (a << 3) | b;
}

/** RJMP k (−2048 ≤ k ≤ 2047 words, relative to PC+1) — 1100 kkkk kkkk kkkk. 2 cycles. */
export function RJMP(k: number): number {
  assertRange(k, -2048, 2047, 'RJMP offset');
  return 0xc000 | (k & 0x0fff);
}

/** ORI Rd,K (16 ≤ d ≤ 31) — 0110 KKKK dddd KKKK. 1 cycle. */
export function ORI(d: number, k: number): number {
  assertRange(d, 16, 31, 'ORI register');
  assertRange(k, 0, 0xff, 'ORI constant');
  return 0x6000 | ((k & 0xf0) << 4) | ((d - 16) << 4) | (k & 0x0f);
}

/** ANDI Rd,K (16 ≤ d ≤ 31) — 0111 KKKK dddd KKKK. 1 cycle. */
export function ANDI(d: number, k: number): number {
  assertRange(d, 16, 31, 'ANDI register');
  assertRange(k, 0, 0xff, 'ANDI constant');
  return 0x7000 | ((k & 0xf0) << 4) | ((d - 16) << 4) | (k & 0x0f);
}

/** CPI Rd,K (16 ≤ d ≤ 31) — 0011 KKKK dddd KKKK. 1 cycle. */
export function CPI(d: number, k: number): number {
  assertRange(d, 16, 31, 'CPI register');
  assertRange(k, 0, 0xff, 'CPI constant');
  return 0x3000 | ((k & 0xf0) << 4) | ((d - 16) << 4) | (k & 0x0f);
}

/** SBRC Rr,b (skip next if bit clear) — 1111 110r rrrr 0bbb. 1 cycle, +1/+2 on skip. */
export function SBRC(r: number, b: number): number {
  assertRange(r, 0, 31, 'SBRC register');
  assertRange(b, 0, 7, 'SBRC bit');
  return 0xfc00 | (r << 4) | b;
}

/** SBRS Rr,b (skip next if bit set) — 1111 111r rrrr 0bbb. 1 cycle, +1/+2 on skip. */
export function SBRS(r: number, b: number): number {
  assertRange(r, 0, 31, 'SBRS register');
  assertRange(b, 0, 7, 'SBRS bit');
  return 0xfe00 | (r << 4) | b;
}

/** DEC Rd — 1001 010d dddd 1010. 1 cycle. */
export function DEC(d: number): number {
  assertRange(d, 0, 31, 'DEC register');
  return 0x940a | (d << 4);
}

/** BRNE k (−64 ≤ k ≤ 63 words, relative to PC+1) — 1111 01kk kkkk k001. 1/2 cycles. */
export function BRNE(k: number): number {
  assertRange(k, -64, 63, 'BRNE offset');
  return 0xf401 | ((k & 0x7f) << 3);
}

/** BRLO k (= BRBS 0, branch if C set; −64 ≤ k ≤ 63 words) — 1111 00kk kkkk k000. 1/2 cycles. */
export function BRLO(k: number): number {
  assertRange(k, -64, 63, 'BRLO offset');
  return 0xf000 | ((k & 0x7f) << 3);
}

/** BRSH k (= BRBC 0, branch if C clear; −64 ≤ k ≤ 63 words) — 1111 01kk kkkk k000. 1/2 cycles. */
export function BRSH(k: number): number {
  assertRange(k, -64, 63, 'BRSH offset');
  return 0xf400 | ((k & 0x7f) << 3);
}

/** WDR — 1001 0101 1010 1000. Feeds the watchdog. 1 cycle. */
export function WDR(): number {
  return 0x95a8;
}

/**
 * STS k,Rr (two words) — 1001 001r rrrr 0000 + 16-bit data address.
 * 2 cycles. Needed for extended-I/O registers (e.g. UCSR0B/UDR0)
 * that OUT cannot reach.
 */
export function STS(addr: number, r: number): number[] {
  assertRange(addr, 0, 0xffff, 'STS address');
  assertRange(r, 0, 31, 'STS register');
  return [0x9200 | (r << 4), addr];
}

/** LDS Rd,k (two words) — 1001 000d dddd 0000 + 16-bit data address. 2 cycles. */
export function LDS(d: number, addr: number): number[] {
  assertRange(addr, 0, 0xffff, 'LDS address');
  assertRange(d, 0, 31, 'LDS register');
  return [0x9000 | (d << 4), addr];
}

/**
 * Flatten a program (16-bit words; STS/LDS contribute word pairs) into
 * the little-endian byte image that AVR flash actually holds.
 */
export function assemble(program: (number | number[])[]): Uint8Array {
  const words = program.flat();
  const out = new Uint8Array(words.length * 2);
  for (let i = 0; i < words.length; i++) {
    const w = words[i] ?? 0;
    assertRange(w, 0, 0xffff, `word ${i}`);
    out[i * 2] = w & 0xff;
    out[i * 2 + 1] = (w >> 8) & 0xff;
  }
  return out;
}

/** ATmega328P I/O-space addresses (for IN/OUT/SBI/CBI). Datasheet §36. */
export const IO = {
  PINB: 0x03,
  DDRB: 0x04,
  PORTB: 0x05,
  PINC: 0x06,
  DDRC: 0x07,
  PORTC: 0x08,
  PIND: 0x09,
  DDRD: 0x0a,
  PORTD: 0x0b,
  EECR: 0x1f,
  EEDR: 0x20,
  EEARL: 0x21,
  EEARH: 0x22,
  TCCR0A: 0x24,
  TCCR0B: 0x25,
  TCNT0: 0x26,
  MCUSR: 0x34,
} as const;

/** ATmega328P data-space addresses (for LDS/STS). Datasheet §36. */
export const MEM = {
  WDTCSR: 0x60,
  ADCL: 0x78,
  ADCH: 0x79,
  ADCSRA: 0x7a,
  ADCSRB: 0x7b,
  ADMUX: 0x7c,
  UCSR0A: 0xc0,
  UCSR0B: 0xc1,
  UCSR0C: 0xc2,
  UBRR0L: 0xc4,
  UBRR0H: 0xc5,
  UDR0: 0xc6,
} as const;
