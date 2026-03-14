// ---------------------------------------------------------------------------
// Flash Progress & Error Diagnostics
// ---------------------------------------------------------------------------
// Parses avrdude / esptool stdout/stderr during firmware upload into
// structured progress events and translates flash errors into beginner-
// friendly diagnostics with actionable fix suggestions.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Sequential stages of a firmware flash operation. */
export type FlashStage =
  | 'connecting'
  | 'erasing'
  | 'writing'
  | 'verifying'
  | 'resetting'
  | 'done'
  | 'error';

/** Progress snapshot emitted as flash output lines are parsed. */
export interface FlashProgress {
  /** Current stage of the flash process. */
  stage: FlashStage;
  /** 0-100 overall progress percentage. */
  percent: number;
  /** Bytes written so far (may be 0 when not applicable). */
  bytesWritten: number;
  /** Total bytes to write (may be 0 when unknown). */
  totalBytes: number;
  /** Human-readable label for the current stage. */
  stageLabel: string;
  /** Optional raw line that triggered this progress update. */
  rawLine?: string;
}

/** Structured error diagnostic for a flash failure. */
export interface FlashDiagnostic {
  /** Short error code for programmatic use. */
  errorCode: string;
  /** Plain English explanation of what went wrong. */
  message: string;
  /** Actionable suggestions — beginner-friendly. */
  suggestions: string[];
  /** Whether the error is likely fixable by simply retrying. */
  isRetryable: boolean;
  /** The raw error output that was analyzed. */
  rawOutput: string;
}

// ---------------------------------------------------------------------------
// Stage labels — user-facing
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<FlashStage, string> = {
  connecting: 'Connecting to board...',
  erasing: 'Erasing flash memory...',
  writing: 'Writing firmware...',
  verifying: 'Verifying upload...',
  resetting: 'Resetting board...',
  done: 'Upload complete!',
  error: 'Upload failed',
};

// ---------------------------------------------------------------------------
// Progress parsing — avrdude patterns
// ---------------------------------------------------------------------------

// avrdude: writing flash (32768 bytes):
const AVRDUDE_WRITING_RE = /avrdude.*?writing\s+(?:flash|eeprom)\s*\((\d+)\s*bytes?\)/i;
// Writing | ################################################## | 100% 3.44s
const AVRDUDE_PROGRESS_RE = /(?:Writing|Reading)\s*\|\s*(#+)\s*\|\s*(\d+)%/i;
// avrdude: verifying ...
const AVRDUDE_VERIFY_RE = /avrdude.*?verifying/i;
// avrdude: bytes of flash verified
const AVRDUDE_VERIFIED_RE = /avrdude.*?(\d+)\s*bytes?\s*of\s*(?:flash|eeprom)\s*verified/i;
// avrdude done.
const AVRDUDE_DONE_RE = /avrdude\s*(?:done|safemode)/i;
// avrdude: erasing chip
const AVRDUDE_ERASE_RE = /avrdude.*?erasing\s*chip/i;
// avrdude: AVR device initialized
const AVRDUDE_INIT_RE = /avrdude.*?(?:AVR device initialized|initialized|found)/i;
// avrdude: stk500_getsync()
const AVRDUDE_CONNECT_RE = /avrdude.*?(?:ser_open|stk500|connecting|Using Port)/i;

// ---------------------------------------------------------------------------
// Progress parsing — esptool patterns
// ---------------------------------------------------------------------------

// Connecting....
const ESPTOOL_CONNECT_RE = /^Connecting\.+/i;
// Chip is ESP32 / ESP8266
const ESPTOOL_CHIP_RE = /^Chip is\s+/i;
// Erasing flash (this may take a while)...
const ESPTOOL_ERASE_RE = /erasing\s*(?:flash|region)/i;
// Writing at 0x00010000... (50%)
const ESPTOOL_WRITE_RE = /Writing at 0x[0-9a-fA-F]+\.\.\.\s*\((\d+)\s*%\)/i;
// Compressed (\d+) bytes to (\d+)
const ESPTOOL_COMPRESSED_RE = /Compressed\s+(\d+)\s*bytes/i;
// Hash of data verified.
const ESPTOOL_VERIFY_RE = /(?:Hash of data verified|Verifying)/i;
// Hard resetting via RTS pin...
const ESPTOOL_RESET_RE = /Hard resetting/i;
// Leaving...
const ESPTOOL_DONE_RE = /^Leaving\.{3}/i;

// ---------------------------------------------------------------------------
// Arduino CLI wrapper patterns
// ---------------------------------------------------------------------------

// "Used ... bytes of ... maximum"
const ARDUINO_SIZE_RE = /Used\s+(\d+)\s*bytes?.*?of.*?(\d+)\s*bytes?/i;

// ---------------------------------------------------------------------------
// parseFlashOutput
// ---------------------------------------------------------------------------

/**
 * Parse a single line of flash tool (avrdude/esptool) output into a progress
 * snapshot. Returns null if the line does not indicate progress.
 *
 * Callers should maintain state between calls — pass the previous progress
 * so the parser can carry forward totalBytes and bytesWritten across lines.
 */
export function parseFlashOutput(
  line: string,
  previous?: FlashProgress,
): FlashProgress | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const prev = previous ?? {
    stage: 'connecting' as FlashStage,
    percent: 0,
    bytesWritten: 0,
    totalBytes: 0,
    stageLabel: STAGE_LABELS.connecting,
  };

  // --- avrdude connection / init ---
  if (AVRDUDE_CONNECT_RE.test(trimmed)) {
    return {
      stage: 'connecting',
      percent: 5,
      bytesWritten: 0,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.connecting,
      rawLine: trimmed,
    };
  }

  if (AVRDUDE_INIT_RE.test(trimmed)) {
    return {
      stage: 'connecting',
      percent: 10,
      bytesWritten: 0,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.connecting,
      rawLine: trimmed,
    };
  }

  // --- avrdude erase ---
  if (AVRDUDE_ERASE_RE.test(trimmed)) {
    return {
      stage: 'erasing',
      percent: 15,
      bytesWritten: 0,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.erasing,
      rawLine: trimmed,
    };
  }

  // --- avrdude writing header (captures total bytes) ---
  const avrWriteMatch = AVRDUDE_WRITING_RE.exec(trimmed);
  if (avrWriteMatch) {
    const totalBytes = parseInt(avrWriteMatch[1], 10);
    return {
      stage: 'writing',
      percent: 20,
      bytesWritten: 0,
      totalBytes,
      stageLabel: STAGE_LABELS.writing,
      rawLine: trimmed,
    };
  }

  // --- avrdude progress bar ---
  const avrProgMatch = AVRDUDE_PROGRESS_RE.exec(trimmed);
  if (avrProgMatch) {
    const pct = parseInt(avrProgMatch[2], 10);
    const stage = prev.stage === 'verifying' ? 'verifying' as const : 'writing' as const;
    // Map avrdude's 0-100% into our overall range:
    // writing = 20-70, verifying = 75-95
    const base = stage === 'writing' ? 20 : 75;
    const range = stage === 'writing' ? 50 : 20;
    const overallPct = Math.round(base + (pct / 100) * range);
    const bytesWritten = prev.totalBytes > 0
      ? Math.round((pct / 100) * prev.totalBytes)
      : 0;
    return {
      stage,
      percent: Math.min(overallPct, 95),
      bytesWritten,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS[stage],
      rawLine: trimmed,
    };
  }

  // --- avrdude verify ---
  if (AVRDUDE_VERIFY_RE.test(trimmed) && !AVRDUDE_VERIFIED_RE.test(trimmed)) {
    return {
      stage: 'verifying',
      percent: 75,
      bytesWritten: prev.bytesWritten,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.verifying,
      rawLine: trimmed,
    };
  }

  // --- avrdude verified complete ---
  if (AVRDUDE_VERIFIED_RE.test(trimmed)) {
    return {
      stage: 'verifying',
      percent: 95,
      bytesWritten: prev.totalBytes,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.verifying,
      rawLine: trimmed,
    };
  }

  // --- avrdude done ---
  if (AVRDUDE_DONE_RE.test(trimmed) && prev.stage !== 'connecting') {
    return {
      stage: 'done',
      percent: 100,
      bytesWritten: prev.totalBytes,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.done,
      rawLine: trimmed,
    };
  }

  // --- esptool connect ---
  if (ESPTOOL_CONNECT_RE.test(trimmed)) {
    return {
      stage: 'connecting',
      percent: 5,
      bytesWritten: 0,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.connecting,
      rawLine: trimmed,
    };
  }

  // --- esptool chip detection ---
  if (ESPTOOL_CHIP_RE.test(trimmed)) {
    return {
      stage: 'connecting',
      percent: 10,
      bytesWritten: 0,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.connecting,
      rawLine: trimmed,
    };
  }

  // --- esptool compressed (captures total bytes) ---
  const compressedMatch = ESPTOOL_COMPRESSED_RE.exec(trimmed);
  if (compressedMatch) {
    return {
      stage: 'writing',
      percent: 18,
      bytesWritten: 0,
      totalBytes: parseInt(compressedMatch[1], 10),
      stageLabel: STAGE_LABELS.writing,
      rawLine: trimmed,
    };
  }

  // --- esptool erase ---
  if (ESPTOOL_ERASE_RE.test(trimmed)) {
    return {
      stage: 'erasing',
      percent: 15,
      bytesWritten: 0,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.erasing,
      rawLine: trimmed,
    };
  }

  // --- esptool writing progress ---
  const espWriteMatch = ESPTOOL_WRITE_RE.exec(trimmed);
  if (espWriteMatch) {
    const pct = parseInt(espWriteMatch[1], 10);
    // Map esptool 0-100% into overall 20-70% range
    const overallPct = Math.round(20 + (pct / 100) * 50);
    const bytesWritten = prev.totalBytes > 0
      ? Math.round((pct / 100) * prev.totalBytes)
      : 0;
    return {
      stage: 'writing',
      percent: Math.min(overallPct, 70),
      bytesWritten,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.writing,
      rawLine: trimmed,
    };
  }

  // --- esptool verify ---
  if (ESPTOOL_VERIFY_RE.test(trimmed)) {
    return {
      stage: 'verifying',
      percent: 90,
      bytesWritten: prev.totalBytes,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.verifying,
      rawLine: trimmed,
    };
  }

  // --- esptool reset ---
  if (ESPTOOL_RESET_RE.test(trimmed)) {
    return {
      stage: 'resetting',
      percent: 95,
      bytesWritten: prev.totalBytes,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.resetting,
      rawLine: trimmed,
    };
  }

  // --- esptool done ---
  if (ESPTOOL_DONE_RE.test(trimmed)) {
    return {
      stage: 'done',
      percent: 100,
      bytesWritten: prev.totalBytes,
      totalBytes: prev.totalBytes,
      stageLabel: STAGE_LABELS.done,
      rawLine: trimmed,
    };
  }

  // --- arduino-cli size report (captures totalBytes if not yet known) ---
  const sizeMatch = ARDUINO_SIZE_RE.exec(trimmed);
  if (sizeMatch) {
    return {
      stage: prev.stage,
      percent: prev.percent,
      bytesWritten: prev.bytesWritten,
      totalBytes: prev.totalBytes || parseInt(sizeMatch[1], 10),
      stageLabel: prev.stageLabel,
      rawLine: trimmed,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Error diagnosis — pattern database
// ---------------------------------------------------------------------------

interface FlashErrorPattern {
  /** Regex to match against the combined error output. */
  pattern: RegExp;
  /** Short programmatic error code. */
  errorCode: string;
  /** Plain English explanation. */
  message: string;
  /** Beginner-friendly suggestions for fixing. */
  suggestions: string[];
  /** Whether simply retrying might fix the issue. */
  isRetryable: boolean;
}

const FLASH_ERROR_PATTERNS: FlashErrorPattern[] = [
  // --- Port / connection errors ---
  {
    pattern: /(?:serial\s*port|port)\s*(?:is\s*)?(?:busy|in use|locked)/i,
    errorCode: 'PORT_BUSY',
    message: 'The serial port is busy. Another program is using the connection to your board.',
    suggestions: [
      'Close any Serial Monitor windows in ProtoPulse or other IDEs.',
      'Close other programs that might be using the port (Arduino IDE, PuTTY, screen).',
      'Unplug and re-plug the USB cable, then try again.',
    ],
    isRetryable: true,
  },
  {
    pattern: /(?:could\s*not\s*open|cannot\s*open|failed\s*to\s*open)\s*(?:port|serial|device)/i,
    errorCode: 'PORT_OPEN_FAILED',
    message: 'Cannot open the serial port. The port may not exist or you may not have permission.',
    suggestions: [
      'Check that your board is plugged in with a working USB cable.',
      'On Linux, you may need to add your user to the "dialout" group: sudo usermod -a -G dialout $USER (then log out and back in).',
      'Try a different USB port or cable.',
      'Make sure no other program is using the port.',
    ],
    isRetryable: true,
  },
  {
    pattern: /(?:no\s*(?:such\s*)?(?:device|port|file))|(?:port\s*(?:not\s*found|does\s*not\s*exist|disappeared))/i,
    errorCode: 'PORT_NOT_FOUND',
    message: 'The serial port was not found. Your board may not be connected or the port name is wrong.',
    suggestions: [
      'Make sure your board is plugged into a USB port.',
      'Try a different USB cable — some cables are charge-only and do not carry data.',
      'Check the port name in your build profile settings.',
      'On Windows, check Device Manager for the correct COM port.',
      'On Mac/Linux, look for /dev/ttyUSB* or /dev/ttyACM* or /dev/cu.* devices.',
    ],
    isRetryable: false,
  },
  {
    pattern: /(?:board|device)\s*(?:not\s*found|not\s*detected|not\s*recognized)/i,
    errorCode: 'BOARD_NOT_FOUND',
    message: 'No board was detected on the selected port.',
    suggestions: [
      'Check that the board is plugged in and powered on.',
      'Try pressing the reset button on your board.',
      'Try a different USB cable or port.',
      'Make sure the correct board type is selected in your build profile.',
    ],
    isRetryable: true,
  },
  {
    pattern: /wrong\s*(?:board|microcontroller|device|chip)|(?:device\s*signature.*?expected)/i,
    errorCode: 'WRONG_BOARD',
    message: 'The board connected does not match the board type selected in your build profile.',
    suggestions: [
      'Open your build profile and verify the board type matches your actual hardware.',
      'Common mix-ups: Arduino Uno vs. Nano, ESP32 vs. ESP8266, Mega 2560 vs. Mega ADK.',
      'If using a clone board, you may need to select a different processor variant.',
    ],
    isRetryable: false,
  },

  // --- Bootloader / sync errors ---
  {
    pattern: /(?:not\s*in\s*sync|sync\s*error|stk500_getsync|stk500_recv)/i,
    errorCode: 'SYNC_ERROR',
    message: 'The upload tool cannot communicate with the board\'s bootloader. The board is not responding as expected.',
    suggestions: [
      'Press the reset button on the board right before the upload starts.',
      'Check that the correct board type is selected — wrong board selection is the most common cause.',
      'Make sure nothing else is connected to pins 0 (RX) and 1 (TX) during upload.',
      'Try disconnecting and reconnecting the USB cable.',
      'The bootloader may be corrupted — you may need to burn a new bootloader using an ISP programmer.',
    ],
    isRetryable: true,
  },
  {
    pattern: /(?:bootloader|boot\s*loader)\s*(?:not\s*(?:found|responding|detected)|timeout|failed)/i,
    errorCode: 'BOOTLOADER_TIMEOUT',
    message: 'The board\'s bootloader did not respond in time. The board may not be entering programming mode.',
    suggestions: [
      'Try pressing the reset button on the board just as the upload begins.',
      'For ESP32: hold the BOOT button, press RESET, then release BOOT.',
      'Check that the board is powered and the USB connection is solid.',
      'The bootloader may need to be re-flashed using an ISP programmer or another Arduino as ISP.',
    ],
    isRetryable: true,
  },

  // --- USB permission errors ---
  {
    pattern: /(?:permission\s*denied|access\s*denied|EACCES|insufficient\s*permissions)/i,
    errorCode: 'USB_PERMISSION',
    message: 'You do not have permission to access the serial port.',
    suggestions: [
      'On Linux: add yourself to the "dialout" group with: sudo usermod -a -G dialout $USER',
      'Then log out and log back in for the change to take effect.',
      'On macOS: check System Preferences > Security & Privacy.',
      'On Windows: try running as Administrator, or check the device driver.',
    ],
    isRetryable: false,
  },

  // --- Connection / communication errors ---
  {
    pattern: /(?:connection\s*(?:failed|refused|timed?\s*out|reset|closed))|(?:failed\s*to\s*connect)/i,
    errorCode: 'CONNECTION_FAILED',
    message: 'The connection to the board failed. The board may not be responding or the USB link is unstable.',
    suggestions: [
      'Unplug and re-plug the USB cable.',
      'Try a different USB port (preferably directly on your computer, not through a hub).',
      'For ESP32/ESP8266: hold the BOOT/FLASH button while uploading.',
      'Check that no other program has the port open.',
    ],
    isRetryable: true,
  },
  {
    pattern: /(?:timed?\s*out)\s*(?:waiting|reading|communicating|during)/i,
    errorCode: 'TIMEOUT',
    message: 'The upload timed out waiting for a response from the board.',
    suggestions: [
      'The board may be unresponsive — try pressing the reset button.',
      'Check the USB cable and connection.',
      'If uploading a large sketch, the board may need more time — try again.',
      'For ESP32: hold the BOOT button during upload.',
    ],
    isRetryable: true,
  },

  // --- Verification errors ---
  {
    pattern: /(?:verification\s*(?:failed|error|mismatch))|(?:content\s*mismatch)|(?:verify\s*error)/i,
    errorCode: 'VERIFICATION_FAILED',
    message: 'The firmware was written but verification failed — the data read back does not match what was sent.',
    suggestions: [
      'Try uploading again — this can be caused by a flaky USB connection.',
      'Use a shorter or higher-quality USB cable.',
      'The flash memory on the board may be damaged — try a different board if retries keep failing.',
      'Check that the board is receiving stable power during the upload.',
    ],
    isRetryable: true,
  },

  // --- Flash memory errors ---
  {
    pattern: /(?:flash\s*(?:write\s*)?error)|(?:program\s*(?:flash\s*)?failed)/i,
    errorCode: 'FLASH_WRITE_ERROR',
    message: 'Writing to the board\'s flash memory failed.',
    suggestions: [
      'Try the upload again — transient write errors can happen.',
      'Make sure the board has stable power (use a good USB cable).',
      'The flash memory may have reached its write cycle limit (unlikely but possible on old boards).',
    ],
    isRetryable: true,
  },

  // --- Sketch too large ---
  {
    pattern: /(?:sketch\s*(?:too\s*(?:big|large))|(?:not\s*enough\s*(?:flash|memory|space))|(?:exceeds\s*(?:available|maximum)\s*(?:flash|memory|space)))/i,
    errorCode: 'SKETCH_TOO_LARGE',
    message: 'The compiled sketch is too large to fit in the board\'s flash memory.',
    suggestions: [
      'Remove unused #include libraries to reduce code size.',
      'Use F() macro for string literals: Serial.println(F("text")) to move strings to flash.',
      'Optimize your code to use less space.',
      'Consider a board with more flash memory (e.g., Arduino Mega, ESP32).',
    ],
    isRetryable: false,
  },

  // --- esptool specific ---
  {
    pattern: /(?:a\s*fatal\s*error\s*occurred)/i,
    errorCode: 'ESPTOOL_FATAL',
    message: 'The ESP upload tool encountered a fatal error.',
    suggestions: [
      'For ESP32: hold the BOOT button, then press RESET, then release BOOT to enter download mode.',
      'For ESP8266: hold FLASH/GPIO0 button during upload.',
      'Check that the correct ESP board variant is selected.',
      'Try a lower upload speed in the board configuration.',
    ],
    isRetryable: true,
  },
  {
    pattern: /(?:MD5\s*(?:of\s*file\s*does\s*not\s*match|mismatch|check\s*failed))/i,
    errorCode: 'MD5_MISMATCH',
    message: 'The uploaded file\'s checksum does not match. The data may have been corrupted during transfer.',
    suggestions: [
      'Try uploading again — this is often a one-time glitch.',
      'Use a shorter or better-quality USB cable.',
      'Try a different USB port on your computer.',
    ],
    isRetryable: true,
  },

  // --- avrdude specific ---
  {
    pattern: /avrdude.*?(?:can['']t\s*open\s*device|no\s*programmer)/i,
    errorCode: 'AVRDUDE_NO_PROGRAMMER',
    message: 'avrdude cannot find a programmer or open the device. The board connection is not working.',
    suggestions: [
      'Check that the board is plugged in.',
      'Verify the port name in your build profile.',
      'Try pressing the reset button on the board.',
      'Make sure the correct programmer type is selected if using an external ISP programmer.',
    ],
    isRetryable: true,
  },
  {
    pattern: /avrdude.*?(?:initialization\s*failed|rc\s*=\s*-1)/i,
    errorCode: 'AVRDUDE_INIT_FAILED',
    message: 'avrdude failed to initialize communication with the board.',
    suggestions: [
      'Check the wiring if using an external programmer.',
      'Try pressing the reset button and uploading again.',
      'Verify the board type is correct in your build profile.',
      'Try a different USB cable or port.',
    ],
    isRetryable: true,
  },
  {
    pattern: /avrdude.*?(?:device\s*signature\s*=\s*0x[0-9a-f]+)/i,
    errorCode: 'WRONG_DEVICE_SIGNATURE',
    message: 'The chip on the board has a different signature than expected. The board type in your profile may be wrong.',
    suggestions: [
      'Double-check the board selection in your build profile.',
      'If using a clone board, try selecting a different processor variant.',
      'Use the "-F" flag to force the upload if you are sure the board is correct (advanced).',
    ],
    isRetryable: false,
  },

  // --- Driver / USB errors ---
  {
    pattern: /(?:USB\s*(?:error|reset|disconnect))|(?:driver\s*(?:error|not\s*(?:found|installed)))/i,
    errorCode: 'USB_DRIVER_ERROR',
    message: 'There is a USB driver problem. The driver for your board may not be installed correctly.',
    suggestions: [
      'Install the board\'s USB driver (CH340, CP2102, or FTDI depending on your board).',
      'On Windows: check Device Manager for unrecognized devices.',
      'Try a different USB port or cable.',
      'Restart your computer if the USB subsystem is unstable.',
    ],
    isRetryable: false,
  },

  // --- Upload protocol errors ---
  {
    pattern: /(?:protocol\s*error)|(?:invalid\s*(?:response|reply|command))/i,
    errorCode: 'PROTOCOL_ERROR',
    message: 'Communication protocol error during upload. The board sent an unexpected response.',
    suggestions: [
      'Make sure the correct board type is selected.',
      'Try pressing the reset button before uploading.',
      'Check that nothing is connected to the serial pins (0/RX, 1/TX) during upload.',
      'The bootloader may be corrupted — try burning a fresh bootloader.',
    ],
    isRetryable: true,
  },

  // --- Power / electrical ---
  {
    pattern: /(?:power\s*(?:fault|overload|brownout))|(?:brownout\s*detect)/i,
    errorCode: 'POWER_ISSUE',
    message: 'The board may be experiencing a power issue (brownout or insufficient power).',
    suggestions: [
      'Use a shorter USB cable or connect directly to the computer (no hub).',
      'Remove any high-power peripherals from the board during upload.',
      'Try a powered USB hub if your computer\'s USB ports cannot supply enough current.',
    ],
    isRetryable: true,
  },

  // --- Fuse / lock bit errors ---
  {
    pattern: /(?:fuse|lock\s*bit)\s*(?:error|mismatch|verification)/i,
    errorCode: 'FUSE_ERROR',
    message: 'Error reading or writing the microcontroller\'s fuse or lock bits.',
    suggestions: [
      'This is an advanced operation — fuse settings control clock, bootloader, and security.',
      'Do not change fuse bits unless you know exactly what you are doing.',
      'Use an ISP programmer to reset fuses if the chip is bricked.',
    ],
    isRetryable: false,
  },

  // --- Generic errors (catch-all, order matters — put these last) ---
  {
    pattern: /(?:upload\s*(?:failed|error))|(?:error\s*(?:during|while)\s*upload)/i,
    errorCode: 'UPLOAD_FAILED',
    message: 'The firmware upload failed.',
    suggestions: [
      'Check that your board is connected and the correct port is selected.',
      'Make sure the board type matches your actual hardware.',
      'Try pressing the reset button and uploading again.',
      'Close any Serial Monitor or other programs using the port.',
    ],
    isRetryable: true,
  },
  {
    pattern: /(?:error|failed|exception|abort)/i,
    errorCode: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred during the upload process.',
    suggestions: [
      'Check the full error output below for more details.',
      'Make sure your board is connected and the correct port is selected.',
      'Try disconnecting and reconnecting the USB cable.',
      'If the problem persists, search the error message online or ask in the Arduino forums.',
    ],
    isRetryable: true,
  },
];

// ---------------------------------------------------------------------------
// diagnoseFlashError
// ---------------------------------------------------------------------------

/**
 * Analyze flash error output and return a beginner-friendly diagnostic with
 * a plain English explanation and actionable suggestions.
 *
 * Matches against 25+ error patterns covering port issues, sync errors,
 * permissions, bootloader problems, verification failures, and more.
 */
export function diagnoseFlashError(errorOutput: string): FlashDiagnostic {
  const trimmed = errorOutput.trim();

  if (!trimmed) {
    return {
      errorCode: 'EMPTY_ERROR',
      message: 'The upload process ended without any output. This usually means the upload tool crashed or could not start.',
      suggestions: [
        'Make sure the Arduino CLI is installed correctly.',
        'Check that the board\'s USB driver is installed.',
        'Try restarting ProtoPulse.',
      ],
      isRetryable: true,
      rawOutput: errorOutput,
    };
  }

  for (const rule of FLASH_ERROR_PATTERNS) {
    if (rule.pattern.test(trimmed)) {
      return {
        errorCode: rule.errorCode,
        message: rule.message,
        suggestions: [...rule.suggestions],
        isRetryable: rule.isRetryable,
        rawOutput: errorOutput,
      };
    }
  }

  // Fallback — no pattern matched
  return {
    errorCode: 'UNRECOGNIZED',
    message: 'An unrecognized error occurred during upload. The raw output may contain more details.',
    suggestions: [
      'Read the raw error output for clues.',
      'Check that your board is connected and powered.',
      'Make sure the correct board type and port are selected.',
      'Search the error message online or ask in the Arduino community forums.',
    ],
    isRetryable: true,
    rawOutput: errorOutput,
  };
}

// ---------------------------------------------------------------------------
// getStageLabel — public utility
// ---------------------------------------------------------------------------

/** Get the user-facing label for a flash stage. */
export function getStageLabel(stage: FlashStage): string {
  return STAGE_LABELS[stage];
}

// ---------------------------------------------------------------------------
// createInitialProgress — factory for starting state
// ---------------------------------------------------------------------------

/** Create the initial FlashProgress for the start of an upload. */
export function createInitialProgress(): FlashProgress {
  return {
    stage: 'connecting',
    percent: 0,
    bytesWritten: 0,
    totalBytes: 0,
    stageLabel: STAGE_LABELS.connecting,
  };
}
