import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import TroubleshootWizard from '@/components/arduino/TroubleshootWizard';
import type { SerialContext } from '@/lib/arduino/serial-troubleshooter';

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props}>{children}</button>,
}));

function buildContext(overrides: Partial<SerialContext> = {}): SerialContext {
  return {
    isConnected: true,
    baudRate: 115200,
    baudMismatchDismissed: false,
    bytesReceived: 0,
    hasGarbledData: false,
    selectedBoard: undefined,
    detectedDeviceLabel: undefined,
    arduinoProfileLabel: undefined,
    boardSafetyLabel: undefined,
    boardBlockerReason: null,
    ...overrides,
  };
}

describe('TroubleshootWizard', () => {
  it('shows the current hardware truth when serial preflight context exists', () => {
    render(
      <TroubleshootWizard
        context={buildContext({
          detectedDeviceLabel: 'ESP32 Dev Module',
          arduinoProfileLabel: 'Arduino Uno Profile',
          boardSafetyLabel: 'Profile mismatch',
          boardBlockerReason: 'The connected device does not match the active Arduino profile.',
        })}
        onClose={() => {}}
      />,
    );

    expect(screen.getByTestId('troubleshoot-preflight-summary')).toHaveTextContent('Current hardware truth');
    expect(screen.getByTestId('troubleshoot-preflight-summary')).toHaveTextContent('ESP32 Dev Module');
    expect(screen.getByTestId('troubleshoot-preflight-summary')).toHaveTextContent('Arduino Uno Profile');
    expect(screen.getByTestId('troubleshoot-preflight-summary')).toHaveTextContent('Profile mismatch');
    expect(screen.getByTestId('troubleshoot-preflight-summary')).toHaveTextContent('does not match the active Arduino profile');
  });
});
