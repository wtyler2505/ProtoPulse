import type { ArduinoBuildProfile } from '@shared/schema';
import { checkBoardMismatch, detectConnectedBoard, type BoardInfo } from '@/lib/board-mismatch-guard';
import type { ConnectionState, SerialPortInfo } from '@/lib/web-serial';
import { KNOWN_BOARD_FILTERS } from '@/lib/web-serial';

export interface SerialDevicePreflightAssessment {
  status: 'not_connected' | 'matched' | 'filter_mismatch' | 'profile_mismatch' | 'device_unidentified';
  blockerReason: string | null;
  boardSafetyLabel: string;
  detectedDeviceLabel: string;
  arduinoProfileLabel: string;
  warnings: string[];
}

function buildExpectedBoard(fqbn: string, name: string): BoardInfo {
  return {
    fqbn,
    name,
    mcu: 'Unknown MCU',
    flashSize: 0,
    ramSize: 0,
  };
}

function formatDetectedDeviceLabel(portInfo: SerialPortInfo | null, detectedBoard: BoardInfo | null): string {
  if (!portInfo) {
    return 'Not connected';
  }

  if (!detectedBoard) {
    return 'Connected device needs review';
  }

  return detectedBoard.name;
}

function evaluateMismatch(
  expectedBoard: BoardInfo,
  detectedBoard: BoardInfo,
): ReturnType<typeof checkBoardMismatch> | null {
  const mismatch = checkBoardMismatch({ board: expectedBoard }, undefined, detectedBoard.fqbn);
  return mismatch.reason ? mismatch : null;
}

export function assessSerialDevicePreflight({
  connectionState,
  normalizedBoardFilter,
  portInfo,
  selectedProfile,
}: {
  connectionState: ConnectionState;
  normalizedBoardFilter: string;
  portInfo: SerialPortInfo | null;
  selectedProfile: ArduinoBuildProfile | undefined;
}): SerialDevicePreflightAssessment {
  const profileLabel = selectedProfile?.name?.trim() || selectedProfile?.profileName?.trim() || selectedProfile?.fqbn || 'No Arduino profile';
  const warnings: string[] = [];

  if (connectionState !== 'connected' || !portInfo) {
    if (selectedProfile && !normalizedBoardFilter) {
      warnings.push(`Serial monitor is set to Any device while the active Arduino profile targets ${profileLabel}.`);
    }

    return {
      status: 'not_connected',
      blockerReason: null,
      boardSafetyLabel: 'Not checked',
      detectedDeviceLabel: 'Not connected',
      arduinoProfileLabel: profileLabel,
      warnings,
    };
  }

  const detectedBoard = detectConnectedBoard(portInfo);
  if (!detectedBoard) {
    if (selectedProfile) {
      warnings.push(`ProtoPulse cannot confirm whether the connected serial device matches the active Arduino profile (${profileLabel}).`);
    }

    return {
      status: 'device_unidentified',
      blockerReason: null,
      boardSafetyLabel: 'Unknown device',
      detectedDeviceLabel: formatDetectedDeviceLabel(portInfo, detectedBoard),
      arduinoProfileLabel: profileLabel,
      warnings,
    };
  }

  const selectedFilter = normalizedBoardFilter
    ? KNOWN_BOARD_FILTERS.find((filter) => filter.label === normalizedBoardFilter)
    : undefined;

  if (selectedProfile) {
    const profileMismatch = evaluateMismatch(
      buildExpectedBoard(selectedProfile.fqbn, profileLabel),
      detectedBoard,
    );

    if (profileMismatch) {
      if (profileMismatch.reason) {
        warnings.push(profileMismatch.reason);
      }
      if (profileMismatch.suggestion) {
        warnings.push(profileMismatch.suggestion);
      }

      return {
        status: 'profile_mismatch',
        blockerReason: `The connected device identifies as ${detectedBoard.name}, but the active Arduino profile targets ${profileLabel}.`,
        boardSafetyLabel: 'Profile mismatch',
        detectedDeviceLabel: detectedBoard.name,
        arduinoProfileLabel: profileLabel,
        warnings,
      };
    }
  }

  if (selectedFilter) {
    const detectedFilterBoard = detectConnectedBoard({
      usbVendorId: selectedFilter.usbVendorId,
      usbProductId: selectedFilter.usbProductId,
    });

    if (detectedFilterBoard) {
      const filterMismatch = evaluateMismatch(detectedFilterBoard, detectedBoard);
      if (filterMismatch) {
        if (filterMismatch.reason) {
          warnings.push(filterMismatch.reason);
        }
        if (filterMismatch.suggestion) {
          warnings.push(filterMismatch.suggestion);
        }

        return {
          status: 'filter_mismatch',
          blockerReason: `The selected serial filter (${normalizedBoardFilter}) does not match the connected device (${detectedBoard.name}).`,
          boardSafetyLabel: 'Filter mismatch',
          detectedDeviceLabel: detectedBoard.name,
          arduinoProfileLabel: profileLabel,
          warnings,
        };
      }
    }
  } else if (selectedProfile) {
    warnings.push(`Serial monitor is set to Any device while the connected hardware matches ${profileLabel}. Locking the filter would reduce wrong-device mistakes.`);
  }

  return {
    status: 'matched',
    blockerReason: null,
    boardSafetyLabel: selectedProfile ? 'Matched to Arduino profile' : normalizedBoardFilter ? 'Matched filter' : 'Connected',
    detectedDeviceLabel: detectedBoard.name,
    arduinoProfileLabel: profileLabel,
    warnings,
  };
}
