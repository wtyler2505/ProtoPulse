/**
 * Verified Board Pack — barrel export and lookup helpers.
 */

export { MEGA_2560_R3 } from './mega-2560-r3';
export { NODEMCU_ESP32S } from './nodemcu-esp32s';
export { RIORAND_KJL01 } from './riorand-kjl01';
export { ARDUINO_UNO_R3 } from './arduino-uno-r3';
export { ARDUINO_NANO } from './arduino-nano';
export { RPI_PICO } from './rpi-pico';
export { STM32_NUCLEO_64 } from './stm32-nucleo-64';
export { ADAFRUIT_FEATHER_M0 } from './adafruit-feather';
export { SPARKFUN_THING_PLUS } from './sparkfun-thing-plus';
export { TEENSY_40 } from './teensy-40';
export { L298N_MOTOR_DRIVER } from './l298n-motor-driver';
export { SSD1306_OLED_I2C } from './ssd1306-oled-i2c';
export { HC_SR04_ULTRASONIC } from './hc-sr04-ultrasonic';

export type {
  BootPinConfig,
  BreadboardFit,
  BusType,
  HeaderGroup,
  PinDirection,
  PinFunction,
  PinFunctionType,
  PinRole,
  VerifiedBoardDefinition,
  VerifiedBus,
  VerifiedPin,
} from './types';

import { MEGA_2560_R3 } from './mega-2560-r3';
import { NODEMCU_ESP32S } from './nodemcu-esp32s';
import { RIORAND_KJL01 } from './riorand-kjl01';
import { ARDUINO_UNO_R3 } from './arduino-uno-r3';
import { ARDUINO_NANO } from './arduino-nano';
import { RPI_PICO } from './rpi-pico';
import { STM32_NUCLEO_64 } from './stm32-nucleo-64';
import { ADAFRUIT_FEATHER_M0 } from './adafruit-feather';
import { SPARKFUN_THING_PLUS } from './sparkfun-thing-plus';
import { TEENSY_40 } from './teensy-40';
import { L298N_MOTOR_DRIVER } from './l298n-motor-driver';
import { SSD1306_OLED_I2C } from './ssd1306-oled-i2c';
import { HC_SR04_ULTRASONIC } from './hc-sr04-ultrasonic';
import type { VerifiedBoardDefinition } from './types';

const ALL_BOARDS: VerifiedBoardDefinition[] = [
  MEGA_2560_R3,
  NODEMCU_ESP32S,
  RIORAND_KJL01,
  ARDUINO_UNO_R3,
  ARDUINO_NANO,
  RPI_PICO,
  STM32_NUCLEO_64,
  ADAFRUIT_FEATHER_M0,
  SPARKFUN_THING_PLUS,
  TEENSY_40,
  L298N_MOTOR_DRIVER,
  SSD1306_OLED_I2C,
  HC_SR04_ULTRASONIC,
];

/** Get a verified board by its stable ID. */
export function getVerifiedBoard(id: string): VerifiedBoardDefinition | undefined {
  return ALL_BOARDS.find((board) => board.id === id);
}

/** Get all verified board definitions. */
export function getAllVerifiedBoards(): VerifiedBoardDefinition[] {
  return ALL_BOARDS;
}

/** Find a verified board matching a natural-language alias query. */
export function findVerifiedBoardByAlias(query: string): VerifiedBoardDefinition | undefined {
  const normalized = query.toLowerCase().trim();
  if (normalized.length === 0) {
    return undefined;
  }

  // Exact ID match first
  const byId = ALL_BOARDS.find((board) => board.id === normalized);
  if (byId) {
    return byId;
  }

  // Title match
  const byTitle = ALL_BOARDS.find((board) => board.title.toLowerCase() === normalized);
  if (byTitle) {
    return byTitle;
  }

  // Alias match
  const byAlias = ALL_BOARDS.find((board) =>
    board.aliases.some((alias) => alias.toLowerCase() === normalized),
  );
  if (byAlias) {
    return byAlias;
  }

  // Substring match on title or aliases
  return ALL_BOARDS.find((board) =>
    board.title.toLowerCase().includes(normalized)
    || board.aliases.some((alias) => alias.toLowerCase().includes(normalized)),
  );
}
