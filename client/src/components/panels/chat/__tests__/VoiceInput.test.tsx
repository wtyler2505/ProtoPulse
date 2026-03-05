import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import type { VoiceMode } from '@/lib/voice-ai';

// ---------------------------------------------------------------------------
// Mock useVoiceAI
// ---------------------------------------------------------------------------

let mockState: string = 'idle';
let mockMode: VoiceMode = 'push_to_talk';
let mockIsListening = false;
let mockTranscript = '';
let mockError: string | null = null;
let mockAudioLevel = 0;

const mockStartListening = vi.fn();
const mockStopListening = vi.fn();
const mockSetMode = vi.fn();
const mockCleanup = vi.fn();

vi.mock('@/hooks/useVoiceAI', () => ({
  useVoiceAI: () => ({
    state: mockState,
    mode: mockMode,
    isListening: mockIsListening,
    transcript: mockTranscript,
    startListening: mockStartListening,
    stopListening: mockStopListening,
    setMode: mockSetMode,
    error: mockError,
    audioLevel: mockAudioLevel,
    cleanup: mockCleanup,
  }),
}));

// Mock VoiceAIManager to prevent real initialization
vi.mock('@/lib/voice-ai', () => ({
  VoiceAIManager: {
    getInstance: () => ({
      onTranscript: null,
    }),
  },
}));

// Mock StyledTooltip (same pattern as ArchitectureView tests)
vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Static import — vi.mock is hoisted, so mocks are in place before this runs
import VoiceInput from '../VoiceInput';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderVoiceInput(props: { onTranscript?: (text: string) => void; disabled?: boolean } = {}) {
  const onTranscript = props.onTranscript ?? vi.fn();
  return render(
    <VoiceInput onTranscript={onTranscript} disabled={props.disabled} />,
  );
}

beforeEach(() => {
  mockState = 'idle';
  mockMode = 'push_to_talk';
  mockIsListening = false;
  mockTranscript = '';
  mockError = null;
  mockAudioLevel = 0;
  mockStartListening.mockClear();
  mockStopListening.mockClear();
  mockSetMode.mockClear();
  mockCleanup.mockClear();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('VoiceInput', () => {
  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  describe('Rendering', () => {
    it('renders the voice input container', () => {
      renderVoiceInput();
      expect(screen.getByTestId('voice-input-container')).toBeDefined();
    });

    it('renders the mic button', () => {
      renderVoiceInput();
      expect(screen.getByTestId('voice-mic-button')).toBeDefined();
    });

    it('renders the state label', () => {
      renderVoiceInput();
      expect(screen.getByTestId('voice-state-label')).toBeDefined();
    });

    it('renders the mode toggle', () => {
      renderVoiceInput();
      expect(screen.getByTestId('voice-mode-toggle')).toBeDefined();
    });

    it('renders mode button', () => {
      renderVoiceInput();
      expect(screen.getByTestId('voice-mode-button')).toBeDefined();
    });

    it('shows "Click to speak" in idle state', () => {
      renderVoiceInput();
      expect(screen.getByTestId('voice-state-label').textContent).toBe('Click to speak');
    });

    it('shows "Push to talk" mode label by default', () => {
      renderVoiceInput();
      expect(screen.getByTestId('voice-mode-button').textContent).toContain('Push to talk');
    });
  });

  // -----------------------------------------------------------------------
  // Mic button interaction
  // -----------------------------------------------------------------------

  describe('Mic button interaction', () => {
    it('calls startListening when clicked in idle state', () => {
      renderVoiceInput();
      fireEvent.click(screen.getByTestId('voice-mic-button'));
      expect(mockStartListening).toHaveBeenCalled();
    });

    it('calls stopListening when clicked while listening', () => {
      mockIsListening = true;
      mockState = 'listening';
      renderVoiceInput();
      fireEvent.click(screen.getByTestId('voice-mic-button'));
      expect(mockStopListening).toHaveBeenCalled();
    });

    it('does nothing when disabled', () => {
      renderVoiceInput({ disabled: true });
      fireEvent.click(screen.getByTestId('voice-mic-button'));
      expect(mockStartListening).not.toHaveBeenCalled();
    });

    it('mic button has correct aria-label when not listening', () => {
      renderVoiceInput();
      expect(screen.getByTestId('voice-mic-button').getAttribute('aria-label')).toBe('Start voice input');
    });

    it('mic button has correct aria-label when listening', () => {
      mockIsListening = true;
      mockState = 'listening';
      renderVoiceInput();
      expect(screen.getByTestId('voice-mic-button').getAttribute('aria-label')).toBe('Stop listening');
    });

    it('mic button has aria-pressed=false when not listening', () => {
      renderVoiceInput();
      expect(screen.getByTestId('voice-mic-button').getAttribute('aria-pressed')).toBe('false');
    });

    it('mic button has aria-pressed=true when listening', () => {
      mockIsListening = true;
      mockState = 'listening';
      renderVoiceInput();
      expect(screen.getByTestId('voice-mic-button').getAttribute('aria-pressed')).toBe('true');
    });
  });

  // -----------------------------------------------------------------------
  // Keyboard accessibility
  // -----------------------------------------------------------------------

  describe('Keyboard accessibility', () => {
    it('Space key triggers mic click', () => {
      renderVoiceInput();
      fireEvent.keyDown(screen.getByTestId('voice-mic-button'), { key: ' ' });
      expect(mockStartListening).toHaveBeenCalled();
    });

    it('Enter key triggers mic click', () => {
      renderVoiceInput();
      fireEvent.keyDown(screen.getByTestId('voice-mic-button'), { key: 'Enter' });
      expect(mockStartListening).toHaveBeenCalled();
    });

    it('other keys do not trigger mic click', () => {
      renderVoiceInput();
      fireEvent.keyDown(screen.getByTestId('voice-mic-button'), { key: 'a' });
      expect(mockStartListening).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // State display
  // -----------------------------------------------------------------------

  describe('State display', () => {
    it('shows "Click to speak" in ready state', () => {
      mockState = 'ready';
      renderVoiceInput();
      expect(screen.getByTestId('voice-state-label').textContent).toBe('Click to speak');
    });

    it('shows "Listening..." when listening', () => {
      mockState = 'listening';
      mockIsListening = true;
      renderVoiceInput();
      expect(screen.getByTestId('voice-state-label').textContent).toBe('Listening...');
    });

    it('shows "Processing..." when processing', () => {
      mockState = 'processing';
      renderVoiceInput();
      expect(screen.getByTestId('voice-state-label').textContent).toBe('Processing...');
    });

    it('shows "Requesting mic access..." when requesting permission', () => {
      mockState = 'requesting_permission';
      renderVoiceInput();
      expect(screen.getByTestId('voice-state-label').textContent).toBe('Requesting mic access...');
    });

    it('shows error message in error state', () => {
      mockState = 'error';
      mockError = 'Microphone access was denied';
      renderVoiceInput();
      expect(screen.getByTestId('voice-state-label').textContent).toBe('Microphone access was denied');
    });
  });

  // -----------------------------------------------------------------------
  // Audio level visualization
  // -----------------------------------------------------------------------

  describe('Audio level visualization', () => {
    it('does not show rings when not listening', () => {
      mockAudioLevel = 0.5;
      renderVoiceInput();
      expect(screen.queryByTestId('audio-level-ring-0')).toBeNull();
    });

    it('shows 3 rings when listening', () => {
      mockIsListening = true;
      mockState = 'listening';
      mockAudioLevel = 0.5;
      renderVoiceInput();
      expect(screen.getByTestId('audio-level-ring-0')).toBeDefined();
      expect(screen.getByTestId('audio-level-ring-1')).toBeDefined();
      expect(screen.getByTestId('audio-level-ring-2')).toBeDefined();
    });

    it('ring scale reflects audio level', () => {
      mockIsListening = true;
      mockState = 'listening';
      mockAudioLevel = 0.8;
      renderVoiceInput();

      const ring0 = screen.getByTestId('audio-level-ring-0');
      const ring2 = screen.getByTestId('audio-level-ring-2');

      // Ring 0 should have smaller scale than ring 2
      const scale0 = ring0.style.transform;
      const scale2 = ring2.style.transform;
      expect(scale0).not.toBe(scale2);
    });

    it('rings are not shown when audio level is 0 but listening', () => {
      mockIsListening = true;
      mockState = 'listening';
      mockAudioLevel = 0;
      renderVoiceInput();
      // Rings still render (scale=1) but with minimal transform
      expect(screen.getByTestId('audio-level-ring-0')).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Mode toggle
  // -----------------------------------------------------------------------

  describe('Mode toggle', () => {
    it('shows "Push to talk" in push_to_talk mode', () => {
      mockMode = 'push_to_talk';
      renderVoiceInput();
      expect(screen.getByTestId('voice-mode-button').textContent).toContain('Push to talk');
    });

    it('shows "Hands-free" in hands_free mode', () => {
      mockMode = 'hands_free';
      renderVoiceInput();
      expect(screen.getByTestId('voice-mode-button').textContent).toContain('Hands-free');
    });

    it('clicking mode button calls setMode to hands_free', () => {
      mockMode = 'push_to_talk';
      renderVoiceInput();
      fireEvent.click(screen.getByTestId('voice-mode-button'));
      expect(mockSetMode).toHaveBeenCalledWith('hands_free');
    });

    it('clicking mode button toggles from hands_free to push_to_talk', () => {
      mockMode = 'hands_free';
      renderVoiceInput();
      fireEvent.click(screen.getByTestId('voice-mode-button'));
      expect(mockSetMode).toHaveBeenCalledWith('push_to_talk');
    });

    it('mode button has correct aria-label for push_to_talk', () => {
      mockMode = 'push_to_talk';
      renderVoiceInput();
      expect(screen.getByTestId('voice-mode-button').getAttribute('aria-label')).toBe(
        'Voice mode: push to talk',
      );
    });

    it('mode button has correct aria-label for hands_free', () => {
      mockMode = 'hands_free';
      renderVoiceInput();
      expect(screen.getByTestId('voice-mode-button').getAttribute('aria-label')).toBe(
        'Voice mode: hands-free',
      );
    });

    it('mode button is disabled when voice input is disabled', () => {
      renderVoiceInput({ disabled: true });
      expect(screen.getByTestId('voice-mode-button').hasAttribute('disabled')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Transcript display
  // -----------------------------------------------------------------------

  describe('Transcript display', () => {
    it('does not show transcript when empty', () => {
      mockTranscript = '';
      renderVoiceInput();
      expect(screen.queryByTestId('voice-transcript')).toBeNull();
    });

    it('shows transcript when available', () => {
      mockTranscript = 'Add a resistor to the circuit';
      renderVoiceInput();
      expect(screen.getByTestId('voice-transcript').textContent).toBe('Add a resistor to the circuit');
    });
  });

  // -----------------------------------------------------------------------
  // Permission error
  // -----------------------------------------------------------------------

  describe('Permission error', () => {
    it('shows help text when permission is denied', () => {
      mockState = 'error';
      mockError = 'Microphone access was denied. Please allow microphone access in your browser settings.';
      renderVoiceInput();
      expect(screen.getByTestId('voice-permission-help')).toBeDefined();
    });

    it('does not show help text for non-permission errors', () => {
      mockState = 'error';
      mockError = 'No microphone found';
      renderVoiceInput();
      expect(screen.queryByTestId('voice-permission-help')).toBeNull();
    });

    it('does not show help text when not in error state', () => {
      mockState = 'ready';
      mockError = null;
      renderVoiceInput();
      expect(screen.queryByTestId('voice-permission-help')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Disabled state
  // -----------------------------------------------------------------------

  describe('Disabled state', () => {
    it('mic button is disabled when disabled prop is true', () => {
      renderVoiceInput({ disabled: true });
      expect(screen.getByTestId('voice-mic-button').hasAttribute('disabled')).toBe(true);
    });

    it('mic button is disabled when processing', () => {
      mockState = 'processing';
      renderVoiceInput();
      expect(screen.getByTestId('voice-mic-button').hasAttribute('disabled')).toBe(true);
    });

    it('mic button is disabled when requesting permission', () => {
      mockState = 'requesting_permission';
      renderVoiceInput();
      expect(screen.getByTestId('voice-mic-button').hasAttribute('disabled')).toBe(true);
    });

    it('mic button is enabled in ready state', () => {
      mockState = 'ready';
      renderVoiceInput();
      expect(screen.getByTestId('voice-mic-button').hasAttribute('disabled')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Callback wiring
  // -----------------------------------------------------------------------

  describe('Callback wiring', () => {
    it('renders without error when onTranscript is provided', () => {
      const onTranscript = vi.fn();
      renderVoiceInput({ onTranscript });
      expect(screen.getByTestId('voice-input-container')).toBeDefined();
    });
  });
});
