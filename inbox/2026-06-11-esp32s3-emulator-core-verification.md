# ESP32-S3 emulator core v0 — verification findings

Verified 2026-06-11 for the `@protopulse/emu` Esp32s3Core (Xtensa LX7
interpreter subset). Two independent sources per fact.

## Xtensa ISA (24-bit core instructions, call0 ABI)

Sources:
1. Espressif "Overview of Xtensa ISA" PDF
   (dl.espressif.com/github_assets/espressif/xtensa-isa-doc) — format
   field layouts + per-instruction semantics.
2. pfalcon/ida-xtensa2 `xtensa.py` (a working disassembler) — exact
   opcode/mask constants, cross-checked against (1) and against
   known-good byte sequences from real objdump listings.

Field layout (24-bit, little-endian): op0=bits[3:0], t=[7:4], s=[11:8],
r=[15:12], op1=[19:16], op2=[23:20]. RRI8 imm8=[23:16]; RI16
imm16=[23:8]; BRI12 imm12=[23:12]; CALL offset18=[23:6].

Key semantics (from the ISA doc, garble-checked):
- Branches (RRI8/BRI12): taken PC ← PC + sext(imm) + 4; else PC += 3.
- J: PC ← PC + sext(offset18) + 4.
- CALL0: a0 ← PC+3; PC ← ((PC>>2) + sext(offset18) + 1) << 2.
- RET: PC ← a0 (encoding 0x000080).
- L32R: addr = ((PC+3) & ~3) + (one_extend(imm16) << 2) — always
  backward.
- MOVI at, imm12: register in t; imm12 = s||imm8 (verified against
  real bytes: `movi a2, 63` = 22 a0 3f).
- Loads/stores scale ZERO-extended offsets: L32I/S32I imm8<<2,
  L16UI/S16I imm8<<1, L8UI/S8I imm8. (The PDF's text extraction
  flattens these to "sign extend" — the RM and real encodings say
  zero-extend + scale; ADDI/ADDMI are the sign-extended ones.)
- SLLI encodes 32−sa in {op2[0], t}; SRLI sa in s; SRAI sa in
  {op2[0], s}; sources in s (SLLI) / t (SRLI, SRAI), dest in r.

Opcode constants used (from ida-xtensa2, masks honored):
L32R 0x000001, MOVI 0x00a002, ADDI 0x00c002, ADDMI 0x00d002,
ADD 0x800000, SUB 0xc00000, AND 0x100000, OR 0x200000, XOR 0x300000,
SLLI 0x010000, SRLI 0x410000, SRAI 0x210000, L32I 0x002002,
S32I 0x006002, L8UI 0x000002, S8I 0x004002, L16UI 0x001002,
S16I 0x005002, BEQ 0x001007, BNE 0x009007, BLT 0x002007,
BGE 0x00a007, BLTU 0x003007, BGEU 0x00b007, BEQZ 0x000016,
BNEZ 0x000056, J 0x000006, JX 0x0000a0, CALL0 0x000005,
CALLX0 0x0000c0, RET 0x000080, MEMW 0x0020c0, NOP 0x0020f0.

Honest cut: 16-bit code-density forms NOT implemented (the assembler
emits only 24-bit instructions); windowed-ABI instructions
(ENTRY/CALL8/RETW) not implemented — call0 ABI only.

## ESP32-S3 memory map + peripherals

Source: Espressif esp-idf v5.2 headers (the vendor's own code):
- `components/soc/esp32s3/include/soc/soc.h`:
  SOC_IRAM_LOW 0x40370000, SOC_IRAM_HIGH 0x403E0000;
  SOC_DRAM_LOW 0x3FC88000, SOC_DRAM_HIGH 0x3FD00000.
  (0x40378000 in IRAM aliases 0x3FC88000 in DRAM — same SRAM, two
  buses.)
- `components/soc/esp32s3/include/soc/reg_base.h`:
  DR_REG_GPIO_BASE 0x60004000, DR_REG_UART_BASE 0x60000000 (UART0).
- `components/soc/esp32s3/include/soc/gpio_reg.h` (offsets from base):
  OUT 0x04, OUT_W1TS 0x08, OUT_W1TC 0x0C, OUT1 0x10, OUT1_W1TS 0x14,
  OUT1_W1TC 0x18, ENABLE 0x20, ENABLE_W1TS 0x24, ENABLE_W1TC 0x28,
  ENABLE1 0x2C, ENABLE1_W1TS 0x30, ENABLE1_W1TC 0x34, IN 0x3C,
  IN1 0x40. (OUT covers GPIO0–31; OUT1 covers GPIO32–48.)
- `components/soc/esp32s3/include/soc/uart_reg.h`:
  UART_FIFO_REG +0x0 (RXFIFO_RD_BYTE [7:0]);
  UART_STATUS_REG +0x1C (RXFIFO_CNT [9:0], TXFIFO_CNT [25:16]).

Emulator cuts (stated in the core header): one 480 KB SRAM window
mapped at both 0x40378000 and 0x3FC88000 (no SRAM0/cache modeling),
single core, 1 instruction = 1 cycle at 240 MHz, raw-image loading
only (no bootloader/IDF app format), no interrupts.
