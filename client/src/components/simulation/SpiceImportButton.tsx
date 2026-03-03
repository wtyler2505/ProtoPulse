import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ACCEPTED_EXTENSIONS = '.lib,.mod,.ibs';
const SESSION_KEY = 'protopulse-session-id';

interface ImportResult {
  imported: number;
  models: { name: string; id: number }[];
  errors: string[];
}

async function uploadSpiceFile(file: File): Promise<ImportResult> {
  const sessionId = localStorage.getItem(SESSION_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    'X-Filename': file.name,
  };
  if (sessionId) {
    headers['X-Session-Id'] = sessionId;
  }

  const buffer = await file.arrayBuffer();
  const res = await fetch('/api/spice-models/import', {
    method: 'POST',
    headers,
    body: buffer,
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text();
    let message: string;
    try {
      const json = JSON.parse(text) as { message?: string; errors?: string[] };
      message = json.message ?? json.errors?.join('; ') ?? text;
    } catch {
      message = text || res.statusText;
    }
    throw new Error(message);
  }

  return res.json() as Promise<ImportResult>;
}

function SpiceImportButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: uploadSpiceFile,
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/spice-models'] });
      const desc = data.errors.length > 0
        ? `${data.imported} model(s) imported. ${data.errors.length} warning(s): ${data.errors.slice(0, 3).join('; ')}`
        : `${data.imported} model(s) imported successfully.`;
      toast({
        title: 'SPICE/IBIS Import',
        description: desc,
      });
      setSelectedFile('');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: error.message,
      });
    },
  });

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setSelectedFile(file.name);
    importMutation.mutate(file);
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        onChange={handleFileChange}
        className="hidden"
        data-testid="spice-import-file-input"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={importMutation.isPending}
        data-testid="spice-import-button"
      >
        {importMutation.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        {importMutation.isPending
          ? `Importing ${selectedFile}...`
          : 'Import SPICE/IBIS'}
      </Button>
    </>
  );
}

export default SpiceImportButton;
