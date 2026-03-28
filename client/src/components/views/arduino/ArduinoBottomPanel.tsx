import { useState, Suspense, lazy } from 'react';
import { cn } from '@/lib/utils';
import {
  Terminal,
  Library,
  Package,
  Hash,
  Cpu,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { ArduinoJob } from '@shared/schema';
import type { LinkedError } from '@/lib/arduino/error-knowledge-linker';
import type { NetInfo, InstanceInfo } from '@shared/arduino-pin-generator';
import type { BottomTab } from './types';
import ArduinoConsoleOutput from './ArduinoConsoleOutput';
import ArduinoLibraryManager from './ArduinoLibraryManager';
import ArduinoBoardManager from './ArduinoBoardManager';

const SerialMonitorPanel = lazy(() => import('@/components/panels/SerialMonitorPanel'));
const PinConstantPanel = lazy(() => import('@/components/arduino/PinConstantPanel'));
const SimulationControlPanel = lazy(() => import('@/components/arduino/SimulationControlPanel'));

interface ArduinoBottomPanelProps {
  bottomTab: BottomTab;
  onSetBottomTab: (tab: BottomTab) => void;
  // Console props
  jobs: ArduinoJob[];
  consoleLogs: string[];
  autoScroll: boolean;
  onSetAutoScroll: (value: boolean | ((prev: boolean) => boolean)) => void;
  onClearConsole: () => void;
  translatedErrors: LinkedError[];
  onCancelJob: (jobId: number) => void;
  onDownloadArtifact: (jobId: number) => void;
  // Serial props
  code: string;
  projectId: number;
  // Library props
  installedLibraries: unknown[];
  isLibrariesLoading: boolean;
  searchLibraries: (query: string) => Promise<unknown>;
  installLibrary: (name: string) => Promise<{ success: boolean; output: string }>;
  uninstallLibrary: (name: string) => Promise<{ success: boolean; output: string }>;
  refreshLibraries: () => void;
  // Board props
  installedCores: unknown[];
  isCoresLoading: boolean;
  searchCores: (query: string) => Promise<unknown>;
  installCore: (platform: string) => Promise<{ success: boolean; output: string }>;
  uninstallCore: (platform: string) => Promise<{ success: boolean; output: string }>;
  refreshCores: () => void;
  // Pin constants props
  mappedNets: NetInfo[];
  mappedInstances: InstanceInfo[];
  onInsertPinCode: (pinCode: string) => void;
  // Simulate props
  activeFilePath: string | null;
}

const TABS = [
  { id: 'console' as const, label: 'Output', icon: <Terminal className="w-3 h-3" /> },
  { id: 'serial' as const, label: 'Serial Monitor', icon: <Terminal className="w-3 h-3" /> },
  { id: 'libraries' as const, label: 'Libraries', icon: <Library className="w-3 h-3" /> },
  { id: 'boards' as const, label: 'Boards', icon: <Package className="w-3 h-3" /> },
  { id: 'pins' as const, label: 'Pin Constants', icon: <Hash className="w-3 h-3" /> },
  { id: 'simulate' as const, label: 'Simulate', icon: <Cpu className="w-3 h-3" /> },
];

export default function ArduinoBottomPanel({
  bottomTab,
  onSetBottomTab,
  jobs,
  consoleLogs,
  autoScroll,
  onSetAutoScroll,
  onClearConsole,
  translatedErrors,
  onCancelJob,
  onDownloadArtifact,
  code,
  projectId,
  installedLibraries,
  isLibrariesLoading,
  searchLibraries,
  installLibrary,
  uninstallLibrary,
  refreshLibraries,
  installedCores,
  isCoresLoading,
  searchCores,
  installCore,
  uninstallCore,
  refreshCores,
  mappedNets,
  mappedInstances,
  onInsertPinCode,
  activeFilePath,
}: ArduinoBottomPanelProps) {
  return (
    <div className="h-64 border-t border-border bg-[#0a0a0a] flex flex-col shrink-0">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-card/50 shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onSetBottomTab(tab.id)}
            data-testid={`tab-arduino-${tab.id}`}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2',
              bottomTab === tab.id
                ? 'text-primary border-primary bg-primary/5'
                : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-white/5',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        {bottomTab === 'console' && (
          <div className="ml-auto flex items-center gap-2 px-2">
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-white/5"
              onClick={onClearConsole}
              data-testid="button-arduino-console-clear"
            >
              Clear
            </button>
            <Separator orientation="vertical" className="h-3" />
            <button
              className={cn(
                'text-[10px] px-2 py-0.5 rounded hover:bg-white/5 flex items-center gap-1 transition-colors',
                autoScroll ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => onSetAutoScroll(v => !v)}
              data-testid="button-arduino-autoscroll"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              Auto-scroll
            </button>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {/* Console Tab */}
        {bottomTab === 'console' && (
          <ArduinoConsoleOutput
            jobs={jobs}
            consoleLogs={consoleLogs}
            autoScroll={autoScroll}
            translatedErrors={translatedErrors}
            onCancelJob={onCancelJob}
            onDownloadArtifact={onDownloadArtifact}
          />
        )}

        {/* Serial Monitor Tab */}
        {bottomTab === 'serial' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
            <SerialMonitorPanel code={code} projectId={projectId} />
          </Suspense>
        )}

        {/* Library Manager Tab */}
        {bottomTab === 'libraries' && (
          <ArduinoLibraryManager
            installedLibraries={installedLibraries}
            isLibrariesLoading={isLibrariesLoading}
            searchLibraries={searchLibraries}
            installLibrary={installLibrary}
            uninstallLibrary={uninstallLibrary}
            refreshLibraries={refreshLibraries}
          />
        )}

        {/* Board Manager Tab */}
        {bottomTab === 'boards' && (
          <ArduinoBoardManager
            installedCores={installedCores}
            isCoresLoading={isCoresLoading}
            searchCores={searchCores}
            installCore={installCore}
            uninstallCore={uninstallCore}
            refreshCores={refreshCores}
          />
        )}

        {/* Pin Constants Tab */}
        {bottomTab === 'pins' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
            <div className="h-full overflow-auto p-2" data-testid="arduino-pin-constants-tab">
              <PinConstantPanel
                nets={mappedNets}
                instances={mappedInstances}
                onInsertIntoSketch={onInsertPinCode}
              />
            </div>
          </Suspense>
        )}

        {/* Simulate Tab */}
        {bottomTab === 'simulate' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}>
            <div className="h-full overflow-auto p-2" data-testid="arduino-simulate-tab">
              <SimulationControlPanel
                projectId={projectId}
                firmwarePath={activeFilePath ?? undefined}
              />
            </div>
          </Suspense>
        )}
      </div>
    </div>
  );
}
