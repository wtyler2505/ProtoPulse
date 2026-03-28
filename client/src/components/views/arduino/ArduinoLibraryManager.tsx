import { useState, useCallback } from 'react';
import {
  Loader2,
  Search,
  Download,
  Trash2,
  Library,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface ArduinoLibraryManagerProps {
  installedLibraries: unknown[];
  isLibrariesLoading: boolean;
  searchLibraries: (query: string) => Promise<unknown>;
  installLibrary: (name: string) => Promise<{ success: boolean; output: string }>;
  uninstallLibrary: (name: string) => Promise<{ success: boolean; output: string }>;
  refreshLibraries: () => void;
}

export default function ArduinoLibraryManager({
  installedLibraries,
  isLibrariesLoading,
  searchLibraries,
  installLibrary,
  uninstallLibrary,
  refreshLibraries,
}: ArduinoLibraryManagerProps) {
  const { toast } = useToast();
  const [libSearchQuery, setLibSearchQuery] = useState('');
  const [libSearchResults, setLibSearchResults] = useState<unknown[]>([]);
  const [libSearching, setLibSearching] = useState(false);
  const [libInstalling, setLibInstalling] = useState<string | null>(null);

  const handleLibSearch = useCallback(async () => {
    const q = libSearchQuery.trim();
    if (!q) {
      return;
    }
    setLibSearching(true);
    try {
      const result = await searchLibraries(q);
      const data = (result as Record<string, unknown>)?.libraries ?? (result as Record<string, unknown>)?.data ?? [];
      setLibSearchResults(Array.isArray(data) ? data : []);
    } catch {
      toast({ variant: 'destructive', title: 'Library search failed' });
    } finally {
      setLibSearching(false);
    }
  }, [libSearchQuery, searchLibraries, toast]);

  const handleLibInstall = useCallback(async (name: string) => {
    setLibInstalling(name);
    try {
      const result = await installLibrary(name);
      if (result.success) {
        toast({ title: 'Library installed', description: name });
        refreshLibraries();
      } else {
        toast({ variant: 'destructive', title: 'Install failed', description: result.output });
      }
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Install failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLibInstalling(null);
    }
  }, [installLibrary, refreshLibraries, toast]);

  const handleLibUninstall = useCallback(async (name: string) => {
    setLibInstalling(name);
    try {
      const result = await uninstallLibrary(name);
      if (result.success) {
        toast({ title: 'Library removed', description: name });
        refreshLibraries();
      } else {
        toast({ variant: 'destructive', title: 'Uninstall failed', description: result.output });
      }
    } catch (e: unknown) {
      toast({ variant: 'destructive', title: 'Uninstall failed', description: e instanceof Error ? e.message : String(e) });
    } finally {
      setLibInstalling(null);
    }
  }, [uninstallLibrary, refreshLibraries, toast]);

  return (
    <div className="h-full flex flex-col" data-testid="arduino-library-panel">
      <div className="flex items-center gap-2 p-2 border-b border-border">
        <Input
          placeholder="Search libraries (e.g. Servo, WiFi, Adafruit NeoPixel)..."
          className="h-7 text-xs flex-1"
          value={libSearchQuery}
          onChange={e => setLibSearchQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleLibSearch(); }}
          data-testid="input-arduino-lib-search"
        />
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => void handleLibSearch()}
          disabled={libSearching || !libSearchQuery.trim()}
          data-testid="button-arduino-lib-search"
        >
          {libSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
          Search
        </Button>
        <Separator orientation="vertical" className="h-4" />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 text-muted-foreground"
          onClick={refreshLibraries}
          data-testid="button-arduino-lib-refresh"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLibrariesLoading ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* Installed libraries */}
              {(installedLibraries as Array<Record<string, unknown>>).length > 0 && (
                <div className="mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1">Installed</span>
                  {(installedLibraries as Array<Record<string, unknown>>).map((lib, i) => {
                    const libObj = (lib as Record<string, unknown>).library as Record<string, unknown> | undefined;
                    const name = (libObj?.name ?? lib.name ?? `library-${i}`) as string;
                    const version = (libObj?.version ?? lib.version ?? '') as string;
                    return (
                      <div key={name} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/30 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Library className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="font-medium truncate">{name}</span>
                          {version && <Badge variant="outline" className="text-[8px] h-3.5 px-1">{version}</Badge>}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-1.5"
                          onClick={() => void handleLibUninstall(name)}
                          disabled={libInstalling === name}
                          data-testid={`button-lib-uninstall-${name}`}
                        >
                          {libInstalling === name ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Trash2 className="w-2.5 h-2.5" />}
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Search results */}
              {libSearchResults.length > 0 && (
                <div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1">Search Results</span>
                  {(libSearchResults as Array<Record<string, unknown>>).map((lib, i) => {
                    const name = (lib.name ?? `result-${i}`) as string;
                    const latestVer = ((lib.latest as Record<string, unknown>)?.version ?? lib.version ?? '') as string;
                    const sentence = (lib.sentence ?? '') as string;
                    return (
                      <div key={name} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/30 text-xs">
                        <div className="flex-1 min-w-0 mr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{name}</span>
                            {latestVer && <Badge variant="outline" className="text-[8px] h-3.5 px-1">{latestVer}</Badge>}
                          </div>
                          {sentence && <p className="text-[9px] text-muted-foreground truncate">{sentence}</p>}
                        </div>
                        <Button
                          size="sm"
                          className="h-6 text-[10px] gap-1 px-2"
                          onClick={() => void handleLibInstall(name)}
                          disabled={libInstalling === name}
                          data-testid={`button-lib-install-${name}`}
                        >
                          {libInstalling === name ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Download className="w-2.5 h-2.5" />}
                          Install
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              {installedLibraries.length === 0 && libSearchResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground opacity-40">
                  <Library className="w-8 h-8 mb-2" />
                  <span className="text-[10px]">Search for libraries to install, or view installed ones.</span>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
