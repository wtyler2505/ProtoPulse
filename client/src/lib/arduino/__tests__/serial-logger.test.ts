import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SerialLogger } from '../serial-logger';

describe('SerialLogger', () => {
  let logger: SerialLogger;

  beforeEach(() => {
    logger = SerialLogger.create();
    vi.useFakeTimers();
  });

  afterEach(() => {
    logger.reset();
    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Basic start/stop
  // -----------------------------------------------------------------------

  it('starts in non-recording state', () => {
    expect(logger.isRecording()).toBe(false);
    expect(logger.getRecordingSize()).toBe(0);
    expect(logger.getRecordingDuration()).toBe(0);
    expect(logger.hasData()).toBe(false);
  });

  it('starts recording', () => {
    logger.startRecording();
    expect(logger.isRecording()).toBe(true);
  });

  it('stops recording and returns accumulated data', () => {
    logger.startRecording();
    logger.appendData('hello ');
    logger.appendData('world');
    const result = logger.stopRecording();
    expect(result).toBe('hello world');
    expect(logger.isRecording()).toBe(false);
  });

  it('stopRecording returns empty string if not recording', () => {
    const result = logger.stopRecording();
    expect(result).toBe('');
  });

  it('startRecording is idempotent when already recording', () => {
    logger.startRecording();
    logger.appendData('first');
    logger.startRecording(); // should not reset
    expect(logger.getRecordedData()).toBe('first');
  });

  // -----------------------------------------------------------------------
  // Append data
  // -----------------------------------------------------------------------

  it('appendData is no-op when not recording', () => {
    logger.appendData('should be ignored');
    expect(logger.hasData()).toBe(false);
    expect(logger.getRecordingSize()).toBe(0);
  });

  it('accumulates data and tracks size', () => {
    logger.startRecording();
    logger.appendData('abc');
    expect(logger.getRecordingSize()).toBe(3);
    logger.appendData('def');
    expect(logger.getRecordingSize()).toBe(6);
    expect(logger.getRecordedData()).toBe('abcdef');
  });

  it('tracks size correctly for multi-byte characters', () => {
    logger.startRecording();
    logger.appendData('\u00e9'); // é = 2 bytes in UTF-8
    expect(logger.getRecordingSize()).toBe(2);
  });

  // -----------------------------------------------------------------------
  // Duration
  // -----------------------------------------------------------------------

  it('returns recording duration', () => {
    logger.startRecording();
    vi.advanceTimersByTime(5000);
    expect(logger.getRecordingDuration()).toBeGreaterThanOrEqual(5000);
  });

  it('returns 0 duration when not recording', () => {
    expect(logger.getRecordingDuration()).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Size limit auto-stop
  // -----------------------------------------------------------------------

  it('auto-stops when size exceeds 50MB', () => {
    logger.startRecording();
    const listener = vi.fn();
    logger.subscribe(listener);

    // Create a string that is ~50MB + 1 byte
    const chunk = 'x'.repeat(1024 * 1024); // 1MB
    for (let i = 0; i < 50; i++) {
      logger.appendData(chunk);
    }
    // Still recording since exactly 50MB
    // Now one more byte should trigger auto-stop
    logger.appendData('x');
    expect(logger.isRecording()).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Duration limit auto-stop
  // -----------------------------------------------------------------------

  it('auto-stops after 1 hour', () => {
    logger.startRecording();
    expect(logger.isRecording()).toBe(true);

    vi.advanceTimersByTime(60 * 60 * 1000); // 1 hour
    expect(logger.isRecording()).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Snapshot / subscribe pattern
  // -----------------------------------------------------------------------

  it('getSnapshot returns current state', () => {
    const snap1 = logger.getSnapshot();
    expect(snap1.recording).toBe(false);
    expect(snap1.size).toBe(0);
    expect(snap1.hasData).toBe(false);

    logger.startRecording();
    logger.appendData('test');
    const snap2 = logger.getSnapshot();
    expect(snap2.recording).toBe(true);
    expect(snap2.size).toBe(4);
    expect(snap2.hasData).toBe(true);
  });

  it('subscribe notifies on state changes', () => {
    const listener = vi.fn();
    const unsub = logger.subscribe(listener);

    logger.startRecording();
    expect(listener).toHaveBeenCalledTimes(1);

    logger.appendData('data');
    expect(listener).toHaveBeenCalledTimes(2);

    logger.stopRecording();
    expect(listener).toHaveBeenCalledTimes(3);

    unsub();
    logger.startRecording();
    // Should not receive notification after unsubscribe
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('getSnapshot is referentially stable until state changes', () => {
    const snap1 = logger.getSnapshot();
    const snap2 = logger.getSnapshot();
    expect(snap2).toBe(snap1);

    logger.startRecording();
    const snap3 = logger.getSnapshot();
    expect(snap3).not.toBe(snap1);

    const snap4 = logger.getSnapshot();
    expect(snap4).toBe(snap3);
  });

  // -----------------------------------------------------------------------
  // Download
  // -----------------------------------------------------------------------

  it('downloadAsFile creates and clicks an anchor element', () => {
    logger.startRecording();
    logger.appendData('serial data');
    logger.stopRecording();

    const createObjectURL = vi.fn().mockReturnValue('blob:test');
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    const clickMock = vi.fn();
    const appendChildMock = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      // Intercept the anchor click
      if (node instanceof HTMLAnchorElement) {
        node.click = clickMock;
      }
      return node;
    });

    logger.downloadAsFile();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickMock).toHaveBeenCalledTimes(1);

    appendChildMock.mockRestore();
  });

  it('downloadAsFile is no-op with no data', () => {
    const createObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;

    logger.downloadAsFile();
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('downloadAsFile uses custom filename when provided', () => {
    logger.startRecording('my-log.txt');
    logger.appendData('data');
    logger.stopRecording();

    const createObjectURL = vi.fn().mockReturnValue('blob:test');
    globalThis.URL.createObjectURL = createObjectURL;

    let capturedDownload = '';
    const appendChildMock = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLAnchorElement) {
        capturedDownload = node.download;
        node.click = vi.fn();
      }
      return node;
    });

    logger.downloadAsFile();
    expect(capturedDownload).toBe('my-log.txt');

    appendChildMock.mockRestore();
  });

  // -----------------------------------------------------------------------
  // Clear / Reset
  // -----------------------------------------------------------------------

  it('clear removes data but does not stop recording', () => {
    logger.startRecording();
    logger.appendData('some data');
    expect(logger.getRecordingSize()).toBe(9);

    logger.clear();
    expect(logger.getRecordingSize()).toBe(0);
    expect(logger.hasData()).toBe(false);
    expect(logger.isRecording()).toBe(true);
  });

  it('reset stops recording and clears data', () => {
    logger.startRecording();
    logger.appendData('data');

    logger.reset();
    expect(logger.isRecording()).toBe(false);
    expect(logger.hasData()).toBe(false);
    expect(logger.getRecordingSize()).toBe(0);
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('getInstance returns the same instance', () => {
    const a = SerialLogger.getInstance();
    const b = SerialLogger.getInstance();
    expect(a).toBe(b);
  });

  it('create returns a fresh instance', () => {
    const a = SerialLogger.create();
    const b = SerialLogger.create();
    expect(a).not.toBe(b);
  });
});
