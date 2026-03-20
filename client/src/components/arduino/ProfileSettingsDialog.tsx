import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, Wifi, Usb } from 'lucide-react';
import type { ArduinoBuildProfile } from '@shared/schema';
import { BUILT_IN_PRESETS } from '@/lib/arduino/board-settings';

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: ArduinoBuildProfile | null;
  onSave: (updates: Partial<ArduinoBuildProfile>) => Promise<void>;
}

export default function ProfileSettingsDialog({
  open,
  onOpenChange,
  profile,
  onSave
}: ProfileSettingsDialogProps) {
  const [name, setName] = useState('');
  const [fqbn, setFqbn] = useState('');
  const [port, setPort] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [networkDevices, setNetworkDevices] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (open && profile) {
      setName(profile.name);
      setFqbn(profile.fqbn);
      setPort(profile.port || '');
    } else if (open && !profile) {
      setName('New Profile');
      setFqbn(BUILT_IN_PRESETS[0].fqbn);
      setPort('');
    }
  }, [open, profile]);

  const scanNetwork = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/arduino/mdns-discover');
      const data = await res.json();
      setNetworkDevices(data.devices || []);
    } catch (e) {
      console.error('Failed to scan network', e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ name, fqbn, port });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{profile ? 'Edit Build Profile' : 'New Build Profile'}</DialogTitle>
          <DialogDescription>Configure the board and upload port (USB or OTA).</DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="profile-name">Profile Name</Label>
            <Input id="profile-name" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="board-type">Board (FQBN)</Label>
            <Select value={fqbn} onValueChange={setFqbn}>
              <SelectTrigger>
                <SelectValue placeholder="Select a board" />
              </SelectTrigger>
              <SelectContent>
                {BUILT_IN_PRESETS.map(preset => (
                  <SelectItem key={preset.fqbn} value={preset.fqbn}>{preset.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="upload-port">Upload Port (USB or IP)</Label>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={scanNetwork} disabled={isScanning}>
                {isScanning ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Scan OTA
              </Button>
            </div>
            
            <div className="space-y-2">
              <Input 
                id="upload-port" 
                placeholder="e.g. /dev/ttyUSB0, COM3, or 192.168.1.5" 
                value={port} 
                onChange={e => setPort(e.target.value)} 
              />
              
              {networkDevices.length > 0 && (
                <div className="text-xs border rounded-md p-2 bg-muted/30 space-y-1.5">
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Discovered OTA Devices</div>
                  {networkDevices.map((dev, i) => (
                    <div 
                      key={i} 
                      className="flex items-center justify-between p-1.5 hover:bg-muted rounded cursor-pointer group transition-colors border border-transparent hover:border-border"
                      onClick={() => setPort(dev.ip || dev.host)}
                    >
                      <div className="flex items-center gap-2">
                        <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                        <div>
                          <div className="font-medium text-foreground group-hover:text-primary transition-colors">{dev.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{dev.ip || dev.host}</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 pr-1">Use Port</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving || !name || !fqbn}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}