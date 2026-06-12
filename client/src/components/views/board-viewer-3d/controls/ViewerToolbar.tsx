/**
 * ViewerToolbar — camera presets, board flip, home and exploded-view controls
 * for the WebGL board viewer (PP3D-8).
 *
 * Lives OUTSIDE the `<Canvas>` (regular DOM) and emits {@link ViewerAction}s;
 * the parent executes them against the camera-controls rig / explode state.
 * Every control is a real focusable `<Button>` with an accessible name, which
 * is also what gives the 3D view its keyboard story for the e2e keyboard
 * kernel (BL-0870).
 */

import {
  ArrowDownToLine,
  ArrowUpToLine,
  Box,
  FlipVertical2,
  Home,
  Layers,
  RectangleHorizontal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

import { CAMERA_PRESET_LABELS } from './camera-presets';

import type { CameraPresetId } from './camera-presets';
import type { ViewerAction } from './keyboard-controls';

export interface ViewerToolbarProps {
  /** Execute a viewer action (camera move / flip / explode toggle). */
  onAction: (action: ViewerAction) => void;
  /** Whether the exploded view is currently on (drives `aria-pressed`). */
  exploded: boolean;
}

const PRESET_BUTTONS: readonly {
  preset: CameraPresetId;
  testId: string;
  icon: typeof Box;
}[] = [
  { preset: 'top', testId: 'viewer-preset-top', icon: ArrowUpToLine },
  { preset: 'bottom', testId: 'viewer-preset-bottom', icon: ArrowDownToLine },
  { preset: 'front', testId: 'viewer-preset-front', icon: RectangleHorizontal },
  { preset: 'iso', testId: 'viewer-preset-iso', icon: Box },
];

export function ViewerToolbar({ onAction, exploded }: ViewerToolbarProps) {
  return (
    <div
      data-testid="viewer-3d-toolbar"
      role="toolbar"
      aria-label="3D viewer camera controls"
      className="flex items-center gap-1 flex-wrap"
    >
      {PRESET_BUTTONS.map(({ preset, testId, icon: Icon }) => (
        <Button
          key={preset}
          data-testid={testId}
          variant="outline"
          size="sm"
          aria-label={CAMERA_PRESET_LABELS[preset]}
          title={CAMERA_PRESET_LABELS[preset]}
          onClick={() => { onAction({ type: 'preset', preset }); }}
        >
          <Icon className="w-4 h-4" />
        </Button>
      ))}
      <Button
        data-testid="viewer-flip"
        variant="outline"
        size="sm"
        aria-label="Flip board"
        title="Flip board (F)"
        onClick={() => { onAction({ type: 'flip' }); }}
      >
        <FlipVertical2 className="w-4 h-4" />
      </Button>
      <Button
        data-testid="viewer-home"
        variant="outline"
        size="sm"
        aria-label="Reset view to home"
        title="Reset view to home (R)"
        onClick={() => { onAction({ type: 'reset' }); }}
      >
        <Home className="w-4 h-4" />
      </Button>
      <Button
        data-testid="viewer-explode"
        variant={exploded ? 'default' : 'outline'}
        size="sm"
        aria-label="Toggle exploded view"
        aria-pressed={exploded}
        title="Toggle exploded view (X)"
        onClick={() => { onAction({ type: 'explode-toggle' }); }}
      >
        <Layers className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default ViewerToolbar;
