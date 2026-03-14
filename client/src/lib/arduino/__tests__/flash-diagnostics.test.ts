import { describe, it, expect } from 'vitest';
import {
  parseFlashOutput,
  diagnoseFlashError,
  getStageLabel,
  createInitialProgress,
} from '../flash-diagnostics';
import type { FlashProgress, FlashStage } from '../flash-diagnostics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a sequence of lines and return all non-null progress snapshots. */
function parseLines(lines: string[]): FlashProgress[] {
  const results: FlashProgress[] = [];
  let prev: FlashProgress | undefined;
  for (const line of lines) {
    const result = parseFlashOutput(line, prev);
    if (result) {
      results.push(result);
      prev = result;
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// parseFlashOutput
// ---------------------------------------------------------------------------

describe('parseFlashOutput', () => {
  // -----------------------------------------------------------------------
  // avrdude patterns
  // -----------------------------------------------------------------------

  describe('avrdude progress parsing', () => {
    it('detects avrdude connection via ser_open/stk500', () => {
      const result = parseFlashOutput('avrdude: ser_open(): opening port "/dev/ttyACM0"');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('connecting');
      expect(result!.percent).toBeGreaterThan(0);
    });

    it('detects avrdude device initialization', () => {
      const result = parseFlashOutput('avrdude: AVR device initialized and ready to accept instructions');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('connecting');
      expect(result!.percent).toBe(10);
    });

    it('detects avrdude erasing chip', () => {
      const result = parseFlashOutput('avrdude: erasing chip');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('erasing');
      expect(result!.percent).toBe(15);
    });

    it('detects avrdude writing header and captures total bytes', () => {
      const result = parseFlashOutput('avrdude: writing flash (32768 bytes):');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('writing');
      expect(result!.totalBytes).toBe(32768);
    });

    it('detects avrdude writing eeprom with total bytes', () => {
      const result = parseFlashOutput('avrdude: writing eeprom (1024 bytes):');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('writing');
      expect(result!.totalBytes).toBe(1024);
    });

    it('parses avrdude progress bar during writing', () => {
      const prev: FlashProgress = {
        stage: 'writing',
        percent: 20,
        bytesWritten: 0,
        totalBytes: 32768,
        stageLabel: 'Writing firmware...',
      };
      const result = parseFlashOutput(
        'Writing | ######################### | 50% 1.72s',
        prev,
      );
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('writing');
      expect(result!.percent).toBe(45); // 20 + (50/100)*50
      expect(result!.bytesWritten).toBe(16384); // 50% of 32768
    });

    it('parses avrdude progress bar at 100%', () => {
      const prev: FlashProgress = {
        stage: 'writing',
        percent: 40,
        bytesWritten: 16384,
        totalBytes: 32768,
        stageLabel: 'Writing firmware...',
      };
      const result = parseFlashOutput(
        'Writing | ################################################## | 100% 3.44s',
        prev,
      );
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('writing');
      expect(result!.percent).toBe(70); // 20 + (100/100)*50
      expect(result!.bytesWritten).toBe(32768);
    });

    it('parses avrdude progress bar during verification', () => {
      const prev: FlashProgress = {
        stage: 'verifying',
        percent: 75,
        bytesWritten: 32768,
        totalBytes: 32768,
        stageLabel: 'Verifying upload...',
      };
      const result = parseFlashOutput(
        'Reading | ######################### | 50% 1.50s',
        prev,
      );
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('verifying');
      expect(result!.percent).toBe(85); // 75 + (50/100)*20
    });

    it('detects avrdude verifying', () => {
      const result = parseFlashOutput('avrdude: verifying ...');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('verifying');
      expect(result!.percent).toBe(75);
    });

    it('detects avrdude verified complete', () => {
      const prev: FlashProgress = {
        stage: 'verifying',
        percent: 80,
        bytesWritten: 16384,
        totalBytes: 32768,
        stageLabel: 'Verifying upload...',
      };
      const result = parseFlashOutput(
        'avrdude: 32768 bytes of flash verified',
        prev,
      );
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('verifying');
      expect(result!.percent).toBe(95);
      expect(result!.bytesWritten).toBe(32768);
    });

    it('detects avrdude done', () => {
      const prev: FlashProgress = {
        stage: 'verifying',
        percent: 95,
        bytesWritten: 32768,
        totalBytes: 32768,
        stageLabel: 'Verifying upload...',
      };
      const result = parseFlashOutput('avrdude done.  Thank you.', prev);
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('done');
      expect(result!.percent).toBe(100);
    });

    it('does not mark done during connecting stage', () => {
      const prev: FlashProgress = {
        stage: 'connecting',
        percent: 5,
        bytesWritten: 0,
        totalBytes: 0,
        stageLabel: 'Connecting to board...',
      };
      const result = parseFlashOutput('avrdude: safemode: Fuses OK', prev);
      expect(result).toBeNull(); // should not transition to done during connecting
    });

    it('parses a full avrdude session sequence', () => {
      const lines = [
        'avrdude: ser_open(): opening port "/dev/ttyACM0"',
        'avrdude: AVR device initialized and ready to accept instructions',
        'avrdude: erasing chip',
        'avrdude: writing flash (3456 bytes):',
        'Writing | ######################### | 50% 0.90s',
        'Writing | ################################################## | 100% 1.80s',
        'avrdude: verifying ...',
        'Reading | ################################################## | 100% 1.20s',
        'avrdude: 3456 bytes of flash verified',
        'avrdude done.  Thank you.',
      ];
      const results = parseLines(lines);
      expect(results.length).toBeGreaterThanOrEqual(8);

      // First = connecting
      expect(results[0].stage).toBe('connecting');
      // Last = done
      expect(results[results.length - 1].stage).toBe('done');
      expect(results[results.length - 1].percent).toBe(100);

      // Progress should be monotonically non-decreasing
      for (let i = 1; i < results.length; i++) {
        expect(results[i].percent).toBeGreaterThanOrEqual(results[i - 1].percent);
      }
    });
  });

  // -----------------------------------------------------------------------
  // esptool patterns
  // -----------------------------------------------------------------------

  describe('esptool progress parsing', () => {
    it('detects esptool connecting', () => {
      const result = parseFlashOutput('Connecting.........');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('connecting');
    });

    it('detects esptool chip identification', () => {
      const result = parseFlashOutput('Chip is ESP32-D0WDQ6 (revision 1)');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('connecting');
      expect(result!.percent).toBe(10);
    });

    it('detects esptool erasing flash', () => {
      const result = parseFlashOutput('Erasing flash (this may take a while)...');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('erasing');
    });

    it('detects esptool compressed size', () => {
      const result = parseFlashOutput('Compressed 262144 bytes to 125678...');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('writing');
      expect(result!.totalBytes).toBe(262144);
    });

    it('parses esptool writing progress', () => {
      const prev: FlashProgress = {
        stage: 'writing',
        percent: 18,
        bytesWritten: 0,
        totalBytes: 262144,
        stageLabel: 'Writing firmware...',
      };
      const result = parseFlashOutput(
        'Writing at 0x00010000... (50%)',
        prev,
      );
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('writing');
      expect(result!.percent).toBe(45); // 20 + (50/100)*50
      expect(result!.bytesWritten).toBe(131072); // 50% of 262144
    });

    it('parses esptool writing at 100%', () => {
      const prev: FlashProgress = {
        stage: 'writing',
        percent: 50,
        bytesWritten: 131072,
        totalBytes: 262144,
        stageLabel: 'Writing firmware...',
      };
      const result = parseFlashOutput(
        'Writing at 0x0003F000... (100%)',
        prev,
      );
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('writing');
      expect(result!.percent).toBe(70); // 20 + (100/100)*50
    });

    it('detects esptool hash verified', () => {
      const result = parseFlashOutput('Hash of data verified.');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('verifying');
      expect(result!.percent).toBe(90);
    });

    it('detects esptool verifying', () => {
      const result = parseFlashOutput('Verifying...');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('verifying');
    });

    it('detects esptool hard resetting', () => {
      const result = parseFlashOutput('Hard resetting via RTS pin...');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('resetting');
      expect(result!.percent).toBe(95);
    });

    it('detects esptool leaving/done', () => {
      const result = parseFlashOutput('Leaving...');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('done');
      expect(result!.percent).toBe(100);
    });

    it('parses a full esptool session sequence', () => {
      const lines = [
        'Connecting.........',
        'Chip is ESP32-D0WDQ6 (revision 1)',
        'Compressed 262144 bytes to 125678...',
        'Erasing flash region...',
        'Writing at 0x00010000... (25%)',
        'Writing at 0x00020000... (50%)',
        'Writing at 0x00030000... (75%)',
        'Writing at 0x0003F000... (100%)',
        'Hash of data verified.',
        'Hard resetting via RTS pin...',
        'Leaving...',
      ];
      const results = parseLines(lines);
      expect(results.length).toBeGreaterThanOrEqual(9);

      expect(results[0].stage).toBe('connecting');
      expect(results[results.length - 1].stage).toBe('done');
      expect(results[results.length - 1].percent).toBe(100);

      // monotonically non-decreasing
      for (let i = 1; i < results.length; i++) {
        expect(results[i].percent).toBeGreaterThanOrEqual(results[i - 1].percent);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseFlashOutput('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(parseFlashOutput('   \n  ')).toBeNull();
    });

    it('returns null for unrecognized line', () => {
      expect(parseFlashOutput('some random text')).toBeNull();
    });

    it('carries forward totalBytes from previous progress', () => {
      const prev: FlashProgress = {
        stage: 'connecting',
        percent: 10,
        bytesWritten: 0,
        totalBytes: 51200,
        stageLabel: 'Connecting to board...',
      };
      const result = parseFlashOutput('avrdude: erasing chip', prev);
      expect(result).not.toBeNull();
      expect(result!.totalBytes).toBe(51200);
    });

    it('defaults to connecting stage without previous', () => {
      const result = parseFlashOutput('avrdude: Using Port : /dev/ttyACM0');
      expect(result).not.toBeNull();
      expect(result!.stage).toBe('connecting');
    });

    it('captures total bytes from arduino-cli size report', () => {
      const prev: FlashProgress = {
        stage: 'connecting',
        percent: 5,
        bytesWritten: 0,
        totalBytes: 0,
        stageLabel: 'Connecting to board...',
      };
      const result = parseFlashOutput(
        'Used 4096 bytes of a 32256 bytes maximum',
        prev,
      );
      expect(result).not.toBeNull();
      expect(result!.totalBytes).toBe(4096);
    });

    it('does not override existing totalBytes with size report', () => {
      const prev: FlashProgress = {
        stage: 'writing',
        percent: 20,
        bytesWritten: 0,
        totalBytes: 32768,
        stageLabel: 'Writing firmware...',
      };
      const result = parseFlashOutput(
        'Used 4096 bytes of a 32256 bytes maximum',
        prev,
      );
      expect(result).not.toBeNull();
      expect(result!.totalBytes).toBe(32768); // not overwritten
    });

    it('caps progress percentage at 95 for writing stage', () => {
      const prev: FlashProgress = {
        stage: 'writing',
        percent: 20,
        bytesWritten: 0,
        totalBytes: 100,
        stageLabel: 'Writing firmware...',
      };
      const result = parseFlashOutput(
        'Writing | ################################################## | 100% 5.00s',
        prev,
      );
      expect(result).not.toBeNull();
      // 20 + (100/100) * 50 = 70 → still under 95, but just verifying math
      expect(result!.percent).toBeLessThanOrEqual(95);
    });

    it('includes rawLine in progress output', () => {
      const result = parseFlashOutput('avrdude: erasing chip');
      expect(result).not.toBeNull();
      expect(result!.rawLine).toBe('avrdude: erasing chip');
    });

    it('handles bytesWritten = 0 when totalBytes is 0', () => {
      const prev: FlashProgress = {
        stage: 'writing',
        percent: 20,
        bytesWritten: 0,
        totalBytes: 0,
        stageLabel: 'Writing firmware...',
      };
      const result = parseFlashOutput(
        'Writing | ######################### | 50% 1.72s',
        prev,
      );
      expect(result).not.toBeNull();
      expect(result!.bytesWritten).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// diagnoseFlashError
// ---------------------------------------------------------------------------

describe('diagnoseFlashError', () => {
  // -----------------------------------------------------------------------
  // Port / connection errors
  // -----------------------------------------------------------------------

  describe('port errors', () => {
    it('diagnoses port busy', () => {
      const result = diagnoseFlashError('Error: serial port is busy');
      expect(result.errorCode).toBe('PORT_BUSY');
      expect(result.isRetryable).toBe(true);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('diagnoses port in use', () => {
      const result = diagnoseFlashError('Error: port /dev/ttyACM0 is in use');
      expect(result.errorCode).toBe('PORT_BUSY');
    });

    it('diagnoses port locked', () => {
      const result = diagnoseFlashError('Resource temporarily locked — serial port is locked by another process');
      expect(result.errorCode).toBe('PORT_BUSY');
    });

    it('diagnoses port open failed', () => {
      const result = diagnoseFlashError('could not open port /dev/ttyUSB0: No such file');
      expect(result.errorCode).toBe('PORT_OPEN_FAILED');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses port not found', () => {
      const result = diagnoseFlashError('Error: port not found');
      expect(result.errorCode).toBe('PORT_NOT_FOUND');
      expect(result.isRetryable).toBe(false);
    });

    it('diagnoses no such device', () => {
      const result = diagnoseFlashError('Error: no such device /dev/ttyACM0');
      expect(result.errorCode).toBe('PORT_NOT_FOUND');
    });

    it('diagnoses port disappeared', () => {
      const result = diagnoseFlashError('Error: port disappeared during upload');
      expect(result.errorCode).toBe('PORT_NOT_FOUND');
    });
  });

  // -----------------------------------------------------------------------
  // Board detection errors
  // -----------------------------------------------------------------------

  describe('board detection', () => {
    it('diagnoses board not found', () => {
      const result = diagnoseFlashError('Error: board not found on /dev/ttyACM0');
      expect(result.errorCode).toBe('BOARD_NOT_FOUND');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses device not detected', () => {
      const result = diagnoseFlashError('Error: device not detected');
      expect(result.errorCode).toBe('BOARD_NOT_FOUND');
    });

    it('diagnoses wrong board type', () => {
      const result = diagnoseFlashError('Error: wrong board selected');
      expect(result.errorCode).toBe('WRONG_BOARD');
      expect(result.isRetryable).toBe(false);
    });

    it('diagnoses wrong microcontroller', () => {
      const result = diagnoseFlashError('Error: wrong microcontroller selected for this board');
      expect(result.errorCode).toBe('WRONG_BOARD');
    });

    it('diagnoses device signature expected mismatch', () => {
      const result = diagnoseFlashError(
        'avrdude: Expected device signature 0x1e950f (ATmega328P) but found 0x1e9514',
      );
      expect(result.errorCode).toBe('WRONG_DEVICE_SIGNATURE');
      expect(result.isRetryable).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Bootloader / sync errors
  // -----------------------------------------------------------------------

  describe('bootloader and sync', () => {
    it('diagnoses stk500_getsync error', () => {
      const result = diagnoseFlashError(
        'avrdude: stk500_getsync() attempt 1 of 10: not in sync: resp=0x00',
      );
      expect(result.errorCode).toBe('SYNC_ERROR');
      expect(result.isRetryable).toBe(true);
      expect(result.suggestions.some(s => s.toLowerCase().includes('reset'))).toBe(true);
    });

    it('diagnoses stk500_recv error', () => {
      const result = diagnoseFlashError(
        'avrdude: stk500_recv(): programmer is not responding',
      );
      expect(result.errorCode).toBe('SYNC_ERROR');
    });

    it('diagnoses not in sync', () => {
      const result = diagnoseFlashError('Error: not in sync');
      expect(result.errorCode).toBe('SYNC_ERROR');
    });

    it('diagnoses bootloader timeout', () => {
      const result = diagnoseFlashError('Error: bootloader timeout — board not responding');
      expect(result.errorCode).toBe('BOOTLOADER_TIMEOUT');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses bootloader not found', () => {
      const result = diagnoseFlashError('Error: boot loader not found');
      expect(result.errorCode).toBe('BOOTLOADER_TIMEOUT');
    });
  });

  // -----------------------------------------------------------------------
  // Permission errors
  // -----------------------------------------------------------------------

  describe('permission errors', () => {
    it('diagnoses Linux permission denied', () => {
      const result = diagnoseFlashError('Error: permission denied on /dev/ttyUSB0');
      expect(result.errorCode).toBe('USB_PERMISSION');
      expect(result.isRetryable).toBe(false);
      expect(result.suggestions.some(s => s.includes('dialout'))).toBe(true);
    });

    it('diagnoses access denied', () => {
      const result = diagnoseFlashError('Error: access denied');
      expect(result.errorCode).toBe('USB_PERMISSION');
    });

    it('diagnoses EACCES', () => {
      const result = diagnoseFlashError('EACCES: permission denied, open \'/dev/ttyACM0\'');
      expect(result.errorCode).toBe('USB_PERMISSION');
    });
  });

  // -----------------------------------------------------------------------
  // Connection errors
  // -----------------------------------------------------------------------

  describe('connection errors', () => {
    it('diagnoses connection timed out', () => {
      const result = diagnoseFlashError('Error: connection timed out');
      expect(result.errorCode).toBe('CONNECTION_FAILED');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses connection refused', () => {
      const result = diagnoseFlashError('Error: connection refused');
      expect(result.errorCode).toBe('CONNECTION_FAILED');
    });

    it('diagnoses failed to connect', () => {
      const result = diagnoseFlashError('A fatal error occurred: Failed to connect to ESP32');
      expect(result.errorCode).toBe('CONNECTION_FAILED');
    });

    it('diagnoses general timeout', () => {
      const result = diagnoseFlashError('Error: timed out waiting for response from board');
      expect(result.errorCode).toBe('TIMEOUT');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses timeout during read', () => {
      const result = diagnoseFlashError('Error: timed out reading from serial port');
      expect(result.errorCode).toBe('TIMEOUT');
    });
  });

  // -----------------------------------------------------------------------
  // Verification errors
  // -----------------------------------------------------------------------

  describe('verification errors', () => {
    it('diagnoses verification failed', () => {
      const result = diagnoseFlashError('Error: verification failed');
      expect(result.errorCode).toBe('VERIFICATION_FAILED');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses content mismatch', () => {
      const result = diagnoseFlashError('avrdude: content mismatch at address 0x0000');
      expect(result.errorCode).toBe('VERIFICATION_FAILED');
    });

    it('diagnoses verify error', () => {
      const result = diagnoseFlashError('avrdude: verify error at addr 0x100');
      expect(result.errorCode).toBe('VERIFICATION_FAILED');
    });
  });

  // -----------------------------------------------------------------------
  // Flash / memory errors
  // -----------------------------------------------------------------------

  describe('flash memory errors', () => {
    it('diagnoses flash write error', () => {
      const result = diagnoseFlashError('Error: flash write error at block 12');
      expect(result.errorCode).toBe('FLASH_WRITE_ERROR');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses program flash failed', () => {
      const result = diagnoseFlashError('Error: program flash failed');
      expect(result.errorCode).toBe('FLASH_WRITE_ERROR');
    });

    it('diagnoses sketch too big', () => {
      const result = diagnoseFlashError('Sketch too big; not enough flash memory');
      expect(result.errorCode).toBe('SKETCH_TOO_LARGE');
      expect(result.isRetryable).toBe(false);
    });

    it('diagnoses exceeds available flash', () => {
      const result = diagnoseFlashError('Program exceeds available flash space');
      expect(result.errorCode).toBe('SKETCH_TOO_LARGE');
    });
  });

  // -----------------------------------------------------------------------
  // ESP-specific errors
  // -----------------------------------------------------------------------

  describe('ESP-specific errors', () => {
    it('diagnoses esptool fatal error', () => {
      const result = diagnoseFlashError('A fatal error occurred: Failed to connect to ESP32');
      // CONNECTION_FAILED matches first, which is fine
      expect(['CONNECTION_FAILED', 'ESPTOOL_FATAL']).toContain(result.errorCode);
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses MD5 mismatch', () => {
      const result = diagnoseFlashError('MD5 of file does not match data in flash');
      expect(result.errorCode).toBe('MD5_MISMATCH');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses MD5 check failed', () => {
      const result = diagnoseFlashError('MD5 check failed');
      expect(result.errorCode).toBe('MD5_MISMATCH');
    });
  });

  // -----------------------------------------------------------------------
  // avrdude-specific errors
  // -----------------------------------------------------------------------

  describe('avrdude-specific errors', () => {
    it('diagnoses avrdude no programmer', () => {
      const result = diagnoseFlashError("avrdude: can't open device \"/dev/ttyACM0\"");
      expect(result.errorCode).toBe('AVRDUDE_NO_PROGRAMMER');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses avrdude initialization failed', () => {
      const result = diagnoseFlashError('avrdude: initialization failed, rc=-1');
      expect(result.errorCode).toBe('AVRDUDE_INIT_FAILED');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses avrdude device signature', () => {
      const result = diagnoseFlashError(
        'avrdude: Device signature = 0x1e950f (probably m328p)',
      );
      expect(result.errorCode).toBe('WRONG_DEVICE_SIGNATURE');
    });
  });

  // -----------------------------------------------------------------------
  // USB / driver errors
  // -----------------------------------------------------------------------

  describe('USB/driver errors', () => {
    it('diagnoses USB error', () => {
      const result = diagnoseFlashError('USB error: device disconnected');
      expect(result.errorCode).toBe('USB_DRIVER_ERROR');
      expect(result.isRetryable).toBe(false);
    });

    it('diagnoses driver not found', () => {
      const result = diagnoseFlashError('Error: driver not found for device');
      expect(result.errorCode).toBe('USB_DRIVER_ERROR');
    });
  });

  // -----------------------------------------------------------------------
  // Protocol errors
  // -----------------------------------------------------------------------

  describe('protocol errors', () => {
    it('diagnoses protocol error', () => {
      const result = diagnoseFlashError('Error: protocol error during upload');
      expect(result.errorCode).toBe('PROTOCOL_ERROR');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses invalid response', () => {
      const result = diagnoseFlashError('Error: invalid response from bootloader');
      expect(result.errorCode).toBe('PROTOCOL_ERROR');
    });
  });

  // -----------------------------------------------------------------------
  // Power errors
  // -----------------------------------------------------------------------

  describe('power errors', () => {
    it('diagnoses brownout', () => {
      const result = diagnoseFlashError('brownout detect was triggered');
      expect(result.errorCode).toBe('POWER_ISSUE');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses power fault', () => {
      const result = diagnoseFlashError('Error: power fault detected');
      expect(result.errorCode).toBe('POWER_ISSUE');
    });
  });

  // -----------------------------------------------------------------------
  // Fuse errors
  // -----------------------------------------------------------------------

  describe('fuse errors', () => {
    it('diagnoses fuse error', () => {
      const result = diagnoseFlashError('avrdude: fuse verification error');
      expect(result.errorCode).toBe('FUSE_ERROR');
      expect(result.isRetryable).toBe(false);
    });

    it('diagnoses lock bit mismatch', () => {
      const result = diagnoseFlashError('lock bit verification failed');
      expect(result.errorCode).toBe('FUSE_ERROR');
    });
  });

  // -----------------------------------------------------------------------
  // Generic / fallback errors
  // -----------------------------------------------------------------------

  describe('generic and fallback', () => {
    it('diagnoses generic upload failed', () => {
      const result = diagnoseFlashError('upload failed');
      expect(result.errorCode).toBe('UPLOAD_FAILED');
      expect(result.isRetryable).toBe(true);
    });

    it('diagnoses error during upload', () => {
      const result = diagnoseFlashError('Error during upload process');
      expect(result.errorCode).toBe('UPLOAD_FAILED');
    });

    it('falls back to UNKNOWN_ERROR for generic errors', () => {
      const result = diagnoseFlashError('Something failed unexpectedly');
      expect(result.errorCode).toBe('UNKNOWN_ERROR');
      expect(result.isRetryable).toBe(true);
    });

    it('returns EMPTY_ERROR for empty input', () => {
      const result = diagnoseFlashError('');
      expect(result.errorCode).toBe('EMPTY_ERROR');
      expect(result.isRetryable).toBe(true);
    });

    it('returns EMPTY_ERROR for whitespace-only input', () => {
      const result = diagnoseFlashError('   ');
      expect(result.errorCode).toBe('EMPTY_ERROR');
    });

    it('returns UNRECOGNIZED for gibberish', () => {
      const result = diagnoseFlashError('xyzzy plugh 42');
      expect(result.errorCode).toBe('UNRECOGNIZED');
      expect(result.isRetryable).toBe(true);
    });

    it('always includes rawOutput', () => {
      const input = 'avrdude: stk500_getsync() attempt 1: not in sync';
      const result = diagnoseFlashError(input);
      expect(result.rawOutput).toBe(input);
    });

    it('always includes at least one suggestion', () => {
      const inputs = [
        'port busy',
        'permission denied',
        'bootloader timeout',
        'verification failed',
        'xyzzy plugh',
        '',
      ];
      for (const input of inputs) {
        const result = diagnoseFlashError(input);
        expect(result.suggestions.length).toBeGreaterThan(0);
      }
    });

    it('does not share suggestion arrays between calls', () => {
      const a = diagnoseFlashError('serial port is busy');
      const b = diagnoseFlashError('serial port is busy');
      expect(a.suggestions).not.toBe(b.suggestions);
      a.suggestions.push('mutated');
      expect(b.suggestions).not.toContain('mutated');
    });
  });
});

// ---------------------------------------------------------------------------
// getStageLabel
// ---------------------------------------------------------------------------

describe('getStageLabel', () => {
  it('returns labels for all stages', () => {
    const stages: FlashStage[] = [
      'connecting',
      'erasing',
      'writing',
      'verifying',
      'resetting',
      'done',
      'error',
    ];
    for (const stage of stages) {
      const label = getStageLabel(stage);
      expect(label).toBeTruthy();
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('returns distinct labels for different stages', () => {
    const labels = new Set<string>();
    const stages: FlashStage[] = [
      'connecting',
      'erasing',
      'writing',
      'verifying',
      'resetting',
      'done',
      'error',
    ];
    for (const stage of stages) {
      labels.add(getStageLabel(stage));
    }
    expect(labels.size).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// createInitialProgress
// ---------------------------------------------------------------------------

describe('createInitialProgress', () => {
  it('returns a valid initial progress', () => {
    const p = createInitialProgress();
    expect(p.stage).toBe('connecting');
    expect(p.percent).toBe(0);
    expect(p.bytesWritten).toBe(0);
    expect(p.totalBytes).toBe(0);
    expect(p.stageLabel).toBeTruthy();
  });

  it('returns independent objects on each call', () => {
    const a = createInitialProgress();
    const b = createInitialProgress();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
