import { useEffect, useRef } from 'react';
import { CameraControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type CameraControlsImpl from 'camera-controls';

export type CameraViewPreset = 'home' | 'iso' | 'top' | 'bottom' | 'front';

export type CameraCommand =
  | {
      id: number;
      type: 'preset';
      preset: CameraViewPreset;
      label: string;
    }
  | {
      id: number;
      type: 'orbit';
      azimuth: number;
      polar: number;
      label: string;
    }
  | {
      id: number;
      type: 'dolly';
      distance: number;
      label: string;
    };

export type PendingCameraCommand =
  | Omit<Extract<CameraCommand, { type: 'preset' }>, 'id'>
  | Omit<Extract<CameraCommand, { type: 'orbit' }>, 'id'>
  | Omit<Extract<CameraCommand, { type: 'dolly' }>, 'id'>;

function getPresetLookAt(
  preset: Exclude<CameraViewPreset, 'home'>,
  boardMax: number,
): [number, number, number, number, number, number] {
  const distance = Math.max(boardMax, 20);
  if (preset === 'top') {
    return [0, distance * 1.45, 0.01, 0, 0, 0];
  }
  if (preset === 'bottom') {
    return [0, -distance * 1.45, 0.01, 0, 0, 0];
  }
  if (preset === 'front') {
    return [0, distance * 0.32, distance * 1.55, 0, 0, 0];
  }
  return [distance * 0.7, distance * 0.82, distance * 1.18, 0, 0, 0];
}

export function getCameraPresetLabel(preset: CameraViewPreset): string {
  if (preset === 'home') {
    return 'Home view';
  }
  if (preset === 'iso') {
    return 'Iso view';
  }
  if (preset === 'top') {
    return 'Top view';
  }
  if (preset === 'bottom') {
    return 'Bottom view';
  }
  return 'Front view';
}

export function CameraControlsRig({
  boardMax,
  command,
  onCommandSettled,
}: {
  boardMax: number;
  command: CameraCommand | null;
  onCommandSettled: (label: string) => void;
}) {
  const controlsRef = useRef<CameraControlsImpl | null>(null);
  const savedInitialStateRef = useRef(false);
  const lastCommandIdRef = useRef<number | null>(null);
  const { invalidate } = useThree();

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || savedInitialStateRef.current) {
      return;
    }
    controls.saveState();
    savedInitialStateRef.current = true;
  }, []);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || !command || lastCommandIdRef.current === command.id) {
      return;
    }
    lastCommandIdRef.current = command.id;

    const run = async () => {
      if (command.type === 'preset') {
        if (command.preset === 'home') {
          await controls.reset(true);
        } else {
          await controls.setLookAt(...getPresetLookAt(command.preset, boardMax), true);
        }
      } else if (command.type === 'orbit') {
        await controls.rotate(command.azimuth, command.polar, true);
      } else {
        await controls.dolly(command.distance, true);
      }
      invalidate();
      onCommandSettled(command.label);
    };

    void run();
  }, [boardMax, command, invalidate, onCommandSettled]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      dollyToCursor
      smoothTime={0.25}
      minDistance={Math.max(2, boardMax * 0.06)}
      maxDistance={Math.max(20, boardMax * 4)}
      onUpdate={() => invalidate()}
      onControlEnd={() => invalidate()}
    />
  );
}
