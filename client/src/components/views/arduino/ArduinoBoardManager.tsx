import { useState, useCallback } from 'react';
import {
  Cpu,
  Loader2,
  Search,
  Download,
  Trash2,
  Package,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

const POPULAR_PLATFORMS = [
  { id: 'esp32:esp32', name: 'ESP32' },
  { id: 'rp2040:rp2040', name: 'Raspberry Pi Pico (RP2040)' },
  { id: 'STMicroelectronics:stm32', name: 'STM32' },
  { id: 'adafruit:nrf52', name: 'Adafruit nRF52' },
  { id: 'arduino:avr', name: 'Arduino AVR' },
  { id: 'arduino:megaavr', name: 'Arduino megaAVR' },
  { id: 'arduino:samd', name: 'Arduino SAMD (Zero, MKR)' },
] as const;

interface ArduinoBoardManagerProps {
  installedCores: unknown[];
  isCoresLoading: boolean;
  searchCores: (query: string) => Promise<unknown>;
  installCore: (platform: string) => Promise<{ success: boolean; output: string }>;
  uninstallCore: (platform: string) => Promise<{ success: boolean; output: string }>;
  refreshCores: () => void;
}

export default function ArduinoBoardManager({
  installedCores,
  isCoresLoading,
  searchCores,
  installCore,
  uninstallCore,
  refreshCores,
}: ArduinoBoardManagerProps) {
  const { toast } = useToast();
  const [coreSearchQuery, setCoreSearchQuery] = useState('');
  const [coreSearchResults, setCoreSearchResults] = useState<unknown[]>([]);
  const [coreSearching, setCoreSearching] = useState(false);
  const [coreInstalling, setCoreInstalling] = useState<string | null>(null);

  const handleCoreSearch = useCallback(async () => {
    const q = coreSearchQuery.trim();
    if (!q) {
      return;
    }
    setCoreSearching(true);
    try {
      const result = await searchCores(q);
      const data = (result as Record<string, unknown>)?.data ?? (result as Record<string, unknown>)?.platforms ?? [];
      setCoreSearchResults(Array.isArray(data) ? data : []);
    } catch {
      toast({ variant: 'destructive', title: 'Core search failed' });
    } finally {
      setCoreSearching(false);
    }
  }, [coreSearchQuery, searchCores, toast]);

  const handleCoreInstall = useCallback(async (platform: string) => {
    setCoreInstalling(platform);
    try {
      const result = await installCore(platform);
      if (result.success) {
        toast({ title: 'Core installed', description: platform });
        refreshCores();
      } else {
        toast({ variant: 'destructive', title: 'Install failed', description: result.output });
      }
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Install failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCoreInstalling(null);
    }
  }, [installCore, refreshCores, toast]);

  const handleCoreUninstall = useCallback(async (platform: string) => {
    setCoreInstalling(platform);
    try {
      const result = await uninstallCore(platform);
      if (result.success) {
        toast({ title: 'Core removed', description: platform });
        refreshCores();
      } else {
        toast({ variant: 'destructive', title: 'Uninstall failed', description: result.output });
      }
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Uninstall failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setCoreInstalling(null);
    }
  }, [uninstallCore, refreshCores, toast]);

  return (
    <div className="h-full flex flex-col" data-testid="arduino-board-panel">
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <Input
          placeholder="Search platforms (e.g. esp32, rp2040, stm32, avr)..."
          className="h-7 text-xs flex-1"
          value={coreSearchQuery}
          onChange={e => setCoreSearchQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleCoreSearch(); }}
          data-testid="input-arduino-core-search"
        />
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => void handleCoreSearch()}
          disabled={coreSearching || !coreSearchQuery.trim()}
          data-testid="button-arduino-core-search"
        >
          {coreSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          Search
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-muted-foreground"
          onClick={refreshCores}
          data-testid="button-arduino-core-refresh"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isCoresLoading ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* Installed cores */}
              {(installedCores as Array<Record<string, unknown>>).length > 0 && (
                <div className="mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1">Installed Platforms</span>
                  {(installedCores as Array<Record<string, unknown>>).map((core, i) => {
                    const id = (core.id ?? core.ID ?? `core-${i}`) as string;
                    const name = (core.name ?? core.Name ?? id) as string;
                    const version = (core.installed ?? core.Installed ?? '') as string;
                    return (
                      <div key={id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/30 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Cpu className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="font-medium truncate">{name}</span>
                          <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-mono">{id}</Badge>
                          {version && <Badge variant="outline" className="text-[8px] h-3.5 px-1">{String(version)}</Badge>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-1.5"
                          onClick={() => void handleCoreUninstall(id)}
                          disabled={coreInstalling === id}
                          data-testid={`button-core-uninstall-${id}`}
                        >
                          {coreInstalling === id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Popular platforms quick-install */}
              {coreSearchResults.length === 0 && (
                <div className="mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1">Popular Platforms</span>
                  {POPULAR_PLATFORMS.map(p => (
                    <div key={p.id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/30 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">{p.name}</span>
                        <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-mono">{p.id}</Badge>
                      </div>
                      <Button
                        size="sm"
                        className="h-6 text-[10px] gap-1 px-2"
                        onClick={() => void handleCoreInstall(p.id)}
                        disabled={coreInstalling === p.id}
                        data-testid={`button-core-install-${p.id}`}
                      >
                        {coreInstalling === p.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />}
                        Install
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Core search results */}
              {coreSearchResults.length > 0 && (
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1">Search Results</span>
                  {(coreSearchResults as Array<Record<string, unknown>>).map((core, i) => {
                    const id = (core.id ?? core.ID ?? `result-${i}`) as string;
                    const name = (core.name ?? core.Name ?? id) as string;
                    const latestVer = (core.latest ?? core.Latest ?? '') as string;
                    return (
                      <div key={id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/30 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{name}</span>
                          <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-mono">{id}</Badge>
                          {latestVer && <Badge variant="outline" className="text-[8px] h-3.5 px-1">{String(latestVer)}</Badge>}
                        </div>
                        <Button
                          size="sm"
                          className="h-6 text-[10px] gap-1 px-2"
                          onClick={() => void handleCoreInstall(id)}
                          disabled={coreInstalling === id}
                          data-testid={`button-core-install-search-${id}`}
                        >
                          {coreInstalling === id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />}
                          Install
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {installedCores.length === 0 && coreSearchResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground opacity-40">
                  <Cpu className="w-8 h-8 mb-2" />
                  <span className="text-[10px]">Install platform cores to support more boards.</span>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
