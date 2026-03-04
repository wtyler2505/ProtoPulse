import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CameraComponentId } from '../CameraComponentId';
import type { ComponentIdResult } from '../CameraComponentId';

// ---------------------------------------------------------------------------
// Mock MediaStream and MediaDevices
// ---------------------------------------------------------------------------

const mockTrackStop = vi.fn();

function createMockStream(): MediaStream {
  return {
    getTracks: () => [{ stop: mockTrackStop, kind: 'video' }],
  } as unknown as MediaStream;
}

const mockGetUserMedia = vi.fn<() => Promise<MediaStream>>();

function setupMediaDevices(available = true): void {
  if (available) {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: mockGetUserMedia },
      writable: true,
      configurable: true,
    });
  } else {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  }
}

// Mock HTMLVideoElement.play
const mockPlay = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  value: mockPlay,
  writable: true,
  configurable: true,
});

// Mock videoWidth / videoHeight for capture
Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
  get: () => 640,
  configurable: true,
});
Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
  get: () => 480,
  configurable: true,
});

// Mock canvas getContext and toDataURL
const mockDrawImage = vi.fn();
const mockGetContext = vi.fn().mockReturnValue({ drawImage: mockDrawImage });
HTMLCanvasElement.prototype.getContext = mockGetContext as unknown as typeof HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/jpeg;base64,abc123');

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockResult: ComponentIdResult = {
  componentType: 'Microcontroller',
  packageType: 'QFP-44',
  partNumber: 'ATmega328P',
  manufacturer: 'Microchip',
  pinCount: 44,
  confidence: 'high',
  description: 'ATmega328P 8-bit AVR microcontroller, commonly used in Arduino Uno boards.',
  specifications: ['8-bit AVR', '16 MHz', '32KB Flash', '2KB SRAM'],
  suggestedBom: {
    partNumber: 'ATmega328P-AU',
    manufacturer: 'Microchip',
    description: 'ATmega328P 8-bit AVR MCU, QFP-44',
    category: 'IC',
    unitPrice: 2.5,
  },
  notes: 'Common Arduino MCU. Verify pin 1 orientation with datasheet.',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CameraComponentId', () => {
  let mockOnIdentify: Mock;
  let mockOnAddToBom: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnIdentify = vi.fn();
    mockOnAddToBom = vi.fn();
    setupMediaDevices(true);
    mockGetUserMedia.mockResolvedValue(createMockStream());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial idle state with start camera button', () => {
    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    expect(screen.getByTestId('camera-component-id')).toBeDefined();
    expect(screen.getByTestId('camera-header')).toBeDefined();
    expect(screen.getByTestId('camera-idle-card')).toBeDefined();
    expect(screen.getByTestId('camera-idle-description')).toBeDefined();
    expect(screen.getByTestId('button-start-camera')).toBeDefined();
    expect(screen.getByTestId('camera-icon-container')).toBeDefined();
  });

  it('shows error when camera API is not available', async () => {
    setupMediaDevices(false);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });

    expect(screen.getByTestId('camera-error-card')).toBeDefined();
    expect(screen.getByTestId('error-icon')).toBeDefined();
    expect(screen.getByTestId('error-message').textContent).toContain('Camera API is not available');
    expect(screen.getByTestId('button-try-again')).toBeDefined();
  });

  it('shows error when camera permission is denied', async () => {
    const permError = new DOMException('Permission denied', 'NotAllowedError');
    mockGetUserMedia.mockRejectedValue(permError);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('camera-error-card')).toBeDefined();
    });

    expect(screen.getByTestId('error-message').textContent).toContain('Camera permission was denied');
  });

  it('shows error when no camera is found', async () => {
    const notFoundError = new DOMException('Not found', 'NotFoundError');
    mockGetUserMedia.mockRejectedValue(notFoundError);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-message').textContent).toContain('No camera found');
    });
  });

  it('shows error when camera is in use by another app', async () => {
    const readableError = new DOMException('In use', 'NotReadableError');
    mockGetUserMedia.mockRejectedValue(readableError);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-message').textContent).toContain('already in use');
    });
  });

  it('shows error for unexpected DOMException types', async () => {
    const otherError = new DOMException('Aborted', 'AbortError');
    mockGetUserMedia.mockRejectedValue(otherError);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-message').textContent).toContain('Camera error: Aborted');
    });
  });

  it('shows generic error for non-DOMException errors', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('something unexpected'));

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('error-message').textContent).toContain('unexpected error');
    });
  });

  it('starts camera and shows video stream on success', async () => {
    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('camera-streaming-container')).toBeDefined();
    });

    expect(screen.getByTestId('camera-video')).toBeDefined();
    expect(screen.getByTestId('button-capture')).toBeDefined();
    expect(mockGetUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
  });

  it('captures image from video stream', async () => {
    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    // Start camera
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });

    // Capture image
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });

    expect(screen.getByTestId('camera-captured-container')).toBeDefined();
    expect(screen.getByTestId('captured-image')).toBeDefined();
    expect(screen.getByTestId('button-retake')).toBeDefined();
    expect(screen.getByTestId('button-identify')).toBeDefined();
    // Stream should be stopped after capture
    expect(mockTrackStop).toHaveBeenCalled();
  });

  it('retakes photo by restarting camera', async () => {
    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    // Start camera -> Capture -> Retake
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-retake'));
    });

    // Camera should restart — getUserMedia called again
    await waitFor(() => {
      expect(mockGetUserMedia).toHaveBeenCalledTimes(2);
    });
  });

  it('identifies a component and displays result', async () => {
    mockOnIdentify.mockResolvedValue(mockResult);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    // Start -> Capture -> Identify
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-identify'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('identification-result')).toBeDefined();
    });

    // Check result fields
    expect(screen.getByTestId('result-component-type').textContent).toContain('Microcontroller');
    expect(screen.getByTestId('result-confidence').textContent).toContain('High Confidence');
    expect(screen.getByTestId('result-description').textContent).toContain('ATmega328P');
    expect(screen.getByTestId('result-package').textContent).toContain('QFP-44');
    expect(screen.getByTestId('result-part-number').textContent).toContain('ATmega328P');
    expect(screen.getByTestId('result-manufacturer').textContent).toContain('Microchip');
    expect(screen.getByTestId('result-pin-count').textContent).toContain('44');
    expect(screen.getByTestId('result-notes')).toBeDefined();
    expect(screen.getByTestId('result-card')).toBeDefined();

    // Specification badges
    const specBadges = screen.getAllByTestId('result-spec-badge');
    expect(specBadges.length).toBe(4);

    // BOM button present
    expect(screen.getByTestId('button-add-to-bom')).toBeDefined();
    expect(screen.getByTestId('button-identify-another')).toBeDefined();
  });

  it('handles null identification result', async () => {
    mockOnIdentify.mockResolvedValue(null);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-identify'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('camera-error-card')).toBeDefined();
    });
    expect(screen.getByTestId('error-message').textContent).toContain(
      'Could not identify the component',
    );
  });

  it('handles identification error', async () => {
    mockOnIdentify.mockRejectedValue(new Error('Network error'));

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-identify'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('camera-error-card')).toBeDefined();
    });
    expect(screen.getByTestId('error-message').textContent).toContain(
      'An error occurred during identification',
    );
  });

  it('calls onAddToBom when Add to BOM button is clicked', async () => {
    mockOnIdentify.mockResolvedValue(mockResult);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    // Start -> Capture -> Identify
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-identify'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('button-add-to-bom')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('button-add-to-bom'));

    expect(mockOnAddToBom).toHaveBeenCalledWith(mockResult.suggestedBom);
  });

  it('does not show Add to BOM button when suggestedBom is null', async () => {
    const resultWithoutBom: ComponentIdResult = {
      ...mockResult,
      suggestedBom: null,
    };
    mockOnIdentify.mockResolvedValue(resultWithoutBom);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-identify'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('identification-result')).toBeDefined();
    });

    expect(screen.queryByTestId('button-add-to-bom')).toBeNull();
  });

  it('cleans up media stream on unmount', async () => {
    const { unmount } = render(
      <CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />,
    );

    // Start camera to create stream
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('camera-streaming-container')).toBeDefined();
    });

    mockTrackStop.mockClear();

    // Unmount should stop tracks
    unmount();

    expect(mockTrackStop).toHaveBeenCalled();
  });

  it('reset button returns to idle state', async () => {
    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    // Start camera
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('camera-streaming-container')).toBeDefined();
    });

    // Click reset
    fireEvent.click(screen.getByTestId('button-reset'));

    expect(screen.getByTestId('camera-idle-card')).toBeDefined();
  });

  it('try again button restarts camera after error', async () => {
    setupMediaDevices(false);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });

    expect(screen.getByTestId('camera-error-card')).toBeDefined();

    // Restore media devices and retry
    setupMediaDevices(true);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-try-again'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('camera-streaming-container')).toBeDefined();
    });
  });

  it('displays medium confidence styling', async () => {
    const medResult: ComponentIdResult = {
      ...mockResult,
      confidence: 'medium',
    };
    mockOnIdentify.mockResolvedValue(medResult);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-identify'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('result-confidence').textContent).toContain('Medium Confidence');
    });
  });

  it('displays low confidence styling', async () => {
    const lowResult: ComponentIdResult = {
      ...mockResult,
      confidence: 'low',
    };
    mockOnIdentify.mockResolvedValue(lowResult);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-identify'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('result-confidence').textContent).toContain('Low Confidence');
    });
  });

  it('does not show specifications section when empty', async () => {
    const noSpecResult: ComponentIdResult = {
      ...mockResult,
      specifications: [],
    };
    mockOnIdentify.mockResolvedValue(noSpecResult);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-identify'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('identification-result')).toBeDefined();
    });

    expect(screen.queryByTestId('result-specifications')).toBeNull();
  });

  it('disables identify button when onIdentify is not provided', async () => {
    render(<CameraComponentId />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });

    const identifyBtn = screen.getByTestId('button-identify') as HTMLButtonElement;
    expect(identifyBtn.disabled).toBe(true);
  });

  it('shows requesting state while waiting for camera permission', async () => {
    // Make getUserMedia hang indefinitely
    mockGetUserMedia.mockReturnValue(new Promise(() => {}));

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });

    expect(screen.getByTestId('camera-requesting-card')).toBeDefined();
    expect(screen.getByTestId('requesting-spinner')).toBeDefined();
    expect(screen.getByTestId('requesting-message').textContent).toContain(
      'Requesting camera permission',
    );
  });

  it('strips base64 data URL prefix before calling onIdentify', async () => {
    mockOnIdentify.mockResolvedValue(mockResult);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-identify'));
    });

    await waitFor(() => {
      expect(mockOnIdentify).toHaveBeenCalledWith('abc123');
    });
  });

  it('does not show result details when fields are null', async () => {
    const minimalResult: ComponentIdResult = {
      componentType: 'Unknown Component',
      packageType: '',
      partNumber: null,
      manufacturer: null,
      pinCount: null,
      confidence: 'low',
      description: 'Could not determine component type.',
      specifications: [],
      suggestedBom: null,
      notes: null,
    };
    mockOnIdentify.mockResolvedValue(minimalResult);

    render(<CameraComponentId onIdentify={mockOnIdentify} onAddToBom={mockOnAddToBom} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('button-start-camera'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('button-capture')).toBeDefined();
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-capture'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('button-identify'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('identification-result')).toBeDefined();
    });

    expect(screen.queryByTestId('result-part-number')).toBeNull();
    expect(screen.queryByTestId('result-manufacturer')).toBeNull();
    expect(screen.queryByTestId('result-pin-count')).toBeNull();
    expect(screen.queryByTestId('result-specifications')).toBeNull();
    expect(screen.queryByTestId('result-notes')).toBeNull();
    expect(screen.queryByTestId('button-add-to-bom')).toBeNull();
  });
});
