const fs = require('fs');

let code = fs.readFileSync('client/src/components/views/ArduinoWorkbenchView.tsx', 'utf8');

// Add imports
code = code.replace(
  /import \{ useToast \} from '@\/hooks\/use-toast';/,
  `import { useToast } from '@/hooks/use-toast';\nimport { apiRequest } from '@/lib/queryClient';\nimport { parseCliError } from '@/lib/arduino/cli-error-parser';`
);

// Add state
code = code.replace(
  /  const \[bottomTab, setBottomTab\] = useState<'console' \| 'libraries' \| 'examples' \| 'history' \| 'serial'>\('console'\);/,
  `  const [bottomTab, setBottomTab] = useState<'console' | 'libraries' | 'examples' | 'history' | 'serial'>('console');
  
  // BL-0602: Live error highlighting state
  const [syntaxErrors, setSyntaxErrors] = useState<Array<{ message: string; line?: number }>>([]);
  const [isCheckingSyntax, setIsCheckingSyntax] = useState(false);`
);

// Add useEffect
code = code.replace(
  /\s*\/\/ ---------------------------------------------------------------------------\n\s*\/\/ Handlers\n\s*\/\/ ---------------------------------------------------------------------------/,
  `
  // --- BL-0602: Live Syntax Check (Debounced) ---
  useEffect(() => {
    if (!workspace || !selectedProfile || !activeFile) {
      setSyntaxErrors([]);
      return;
    }
    
    // Don't check empty files
    if (!code.trim()) {
      setSyntaxErrors([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsCheckingSyntax(true);
      try {
        const res = await apiRequest('POST', \`/api/projects/\${projectId}/arduino/check-syntax\`, {
          fqbn: selectedProfile.fqbn,
          sketchPath: workspace.activeSketchPath ?? '.',
          filename: activeFile.relativePath,
          sourceCode: code,
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.stderr) {
            const parsed = parseCliError(data.stderr);
            // Only show errors for the current file
            const fileErrors = parsed.diagnostics
              .filter(d => d.file.endsWith(activeFile.relativePath) || d.file === activeFile.relativePath)
              .map(d => ({
                line: d.line,
                message: \`\${d.severity}: \${d.message}\${d.hint ? \`\\nHint: \${d.hint}\` : ''}\`
              }));
            setSyntaxErrors(fileErrors);
          } else {
            setSyntaxErrors([]); // No errors
          }
        }
      } catch (e) {
        // Ignore network errors for background checks
      } finally {
        setIsCheckingSyntax(false);
      }
    }, 1000); // 1s debounce

    return () => clearTimeout(timeout);
  }, [code, workspace, selectedProfile, activeFile, projectId]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------`
);

// Update CodeEditor props
code = code.replace(
  /<CodeEditor\n\s+value=\{code\}\n\s+onChange=\{handleCodeChange\}\n\s+language=\{editorLanguage\}\n\s+className="h-full"\n\s+\/>/,
  `<CodeEditor
                  value={code}
                  onChange={handleCodeChange}
                  language={editorLanguage}
                  errors={syntaxErrors}
                  className="h-full"
                />`
);

fs.writeFileSync('client/src/components/views/ArduinoWorkbenchView.tsx', code);
