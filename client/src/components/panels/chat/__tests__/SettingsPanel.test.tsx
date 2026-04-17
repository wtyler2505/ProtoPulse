import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPanel from '../SettingsPanel';

const defaultProps = {
  aiProvider: 'gemini' as const,
  setAiProvider: vi.fn(),
  aiModel: 'claude-sonnet-4-5-20250514',
  setAiModel: vi.fn(),
  aiApiKey: '',
  setAiApiKey: vi.fn(),
  googleWorkspaceToken: '',
  setGoogleWorkspaceToken: vi.fn(),
  showApiKey: false,
  setShowApiKey: vi.fn(),
  aiTemperature: 0.7,
  setAiTemperature: vi.fn(),
  customSystemPrompt: '',
  setCustomSystemPrompt: vi.fn(),
  routingStrategy: 'user' as const,
  setRoutingStrategy: vi.fn(),
  previewAiChanges: true,
  setPreviewAiChanges: vi.fn(),
  apiKeyValid: () => true,
  onClearApiKey: vi.fn(),
  onClose: vi.fn(),
};

describe('SettingsPanel', () => {
  it('renders AI Settings header', () => {
    render(<SettingsPanel {...defaultProps} />);
    expect(screen.getByText('AI Settings')).toBeTruthy();
  });

  it('does not show error banner when settingsLoadError is absent', () => {
    render(<SettingsPanel {...defaultProps} />);
    expect(screen.queryByTestId('settings-load-error')).toBeNull();
  });

  it('does not show error banner when settingsLoadError is null', () => {
    render(<SettingsPanel {...defaultProps} settingsLoadError={null} />);
    expect(screen.queryByTestId('settings-load-error')).toBeNull();
  });

  it('shows error banner when settingsLoadError is provided', () => {
    render(
      <SettingsPanel
        {...defaultProps}
        settingsLoadError="Network timeout"
      />,
    );
    const banner = screen.getByTestId('settings-load-error');
    expect(banner).toBeTruthy();
    expect(banner.textContent).toContain('Could not load saved settings');
    expect(banner.textContent).toContain('Network timeout');
  });

  it('shows retry button when onRetrySettingsLoad is provided', () => {
    const onRetry = vi.fn();
    render(
      <SettingsPanel
        {...defaultProps}
        settingsLoadError="Server error"
        onRetrySettingsLoad={onRetry}
      />,
    );
    const retryBtn = screen.getByTestId('retry-settings-load');
    expect(retryBtn).toBeTruthy();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show retry button when onRetrySettingsLoad is absent', () => {
    render(
      <SettingsPanel
        {...defaultProps}
        settingsLoadError="Server error"
      />,
    );
    expect(screen.queryByTestId('retry-settings-load')).toBeNull();
  });

  it('renders model select dropdown', () => {
    render(<SettingsPanel {...defaultProps} />);
    expect(screen.getByTestId('model-select')).toBeTruthy();
  });

  it('calls onClose when Save & Close is clicked', () => {
    const onClose = vi.fn();
    render(<SettingsPanel {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('save-settings'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // Audit finding #60: Google Workspace OAuth token must never be overwritten with
  // the UI sentinel — that would clobber the server-encrypted token with '********'.
  it('does not call setGoogleWorkspaceToken when the value is the stored sentinel', () => {
    const setGoogleWorkspaceToken = vi.fn();
    render(
      <SettingsPanel
        {...defaultProps}
        googleWorkspaceToken="********"
        setGoogleWorkspaceToken={setGoogleWorkspaceToken}
      />,
    );
    fireEvent.click(screen.getByTestId('save-settings'));
    expect(setGoogleWorkspaceToken).not.toHaveBeenCalled();
  });

  it('calls setGoogleWorkspaceToken when a real token is entered', () => {
    const setGoogleWorkspaceToken = vi.fn();
    render(
      <SettingsPanel
        {...defaultProps}
        setGoogleWorkspaceToken={setGoogleWorkspaceToken}
      />,
    );
    const input = screen.getByTestId('google-workspace-token-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ya29.real-oauth-token-value' } });
    fireEvent.click(screen.getByTestId('save-settings'));
    expect(setGoogleWorkspaceToken).toHaveBeenCalledWith('ya29.real-oauth-token-value');
  });

  it('clear-stored-token button zeroes the token', () => {
    const setGoogleWorkspaceToken = vi.fn();
    render(
      <SettingsPanel
        {...defaultProps}
        googleWorkspaceToken="********"
        setGoogleWorkspaceToken={setGoogleWorkspaceToken}
      />,
    );
    fireEvent.click(screen.getByTestId('clear-google-workspace-token'));
    expect(setGoogleWorkspaceToken).toHaveBeenCalledWith('');
  });
});
