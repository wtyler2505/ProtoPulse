import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { EditorView, lineNumbers, keymap } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { cpp } from '@codemirror/lang-cpp';
import { markdown } from '@codemirror/lang-markdown';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { autocompletion } from '@codemirror/autocomplete';
import { lintGutter, linter } from '@codemirror/lint';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import type { Extension } from '@codemirror/state';
import { evalErrorsToDiagnostics } from '@/lib/circuit-dsl/error-mapping';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Dark theme matching ProtoPulse design tokens
// ---------------------------------------------------------------------------

const protoPulseTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'hsl(222.2, 84%, 4.9%)',
      color: 'hsl(210, 40%, 98%)',
      height: '100%',
    },
    '.cm-content': {
      caretColor: 'hsl(217.2, 91.2%, 59.8%)',
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: '13px',
      lineHeight: '1.6',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'hsl(217.2, 91.2%, 59.8%)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'hsl(217.2, 32.6%, 17.5%)',
    },
    '.cm-activeLine': {
      backgroundColor: 'hsl(217.2, 32.6%, 10%)',
    },
    '.cm-gutters': {
      backgroundColor: 'hsl(222.2, 84%, 4.9%)',
      color: 'hsl(215, 20.2%, 45%)',
      borderRight: '1px solid hsl(217.2, 32.6%, 17.5%)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'hsl(217.2, 32.6%, 10%)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 4px',
    },
    '.cm-matchingBracket': {
      backgroundColor: 'hsl(217.2, 32.6%, 25%)',
      outline: '1px solid hsl(217.2, 91.2%, 59.8%)',
    },
    '.cm-tooltip': {
      backgroundColor: 'hsl(222.2, 84%, 8%)',
      border: '1px solid hsl(217.2, 32.6%, 17.5%)',
      color: 'hsl(210, 40%, 98%)',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li[aria-selected]': {
        backgroundColor: 'hsl(217.2, 32.6%, 17.5%)',
      },
    },
    '.cm-panels': {
      backgroundColor: 'hsl(222.2, 84%, 6%)',
      color: 'hsl(210, 40%, 98%)',
    },
    '.cm-search label': {
      color: 'hsl(210, 40%, 80%)',
    },
    '.cm-textfield': {
      backgroundColor: 'hsl(222.2, 84%, 8%)',
      border: '1px solid hsl(217.2, 32.6%, 17.5%)',
      color: 'hsl(210, 40%, 98%)',
    },
    '.cm-button': {
      backgroundColor: 'hsl(217.2, 32.6%, 17.5%)',
      color: 'hsl(210, 40%, 98%)',
      border: '1px solid hsl(217.2, 32.6%, 25%)',
    },
  },
  { dark: true },
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CodeEditorProps {
  value: string;
  onChange: (code: string) => void;
  language?: 'javascript' | 'cpp' | 'markdown';
  errors?: Array<{ message: string; line?: number }>;
  readOnly?: boolean;
  className?: string;
  customExtensions?: Extension[];
}

export interface CodeEditorHandle {
  /** Scroll to and highlight a 1-based line number. */
  goToLine: (line: number) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(function CodeEditor(
  { value, onChange, language = 'javascript', errors, readOnly = false, className, customExtensions = [] },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const readOnlyCompartment = useRef(new Compartment());
  const linterCompartment = useRef(new Compartment());
  const languageCompartment = useRef(new Compartment());

  // Keep onChange ref current so the listener closure doesn't go stale
  onChangeRef.current = onChange;

  // Build error diagnostics from the errors prop using the error-mapping module
  const buildDiagnostics = useCallback(
    (currentErrors: Array<{ message: string; line?: number }> | undefined): Extension => {
      return linter(() => {
        if (!currentErrors || currentErrors.length === 0) {
          return [];
        }
        const view = viewRef.current;
        if (!view) {
          return [];
        }
        const docText = view.state.doc.toString();
        return evalErrorsToDiagnostics(currentErrors, docText);
      });
    },
    [],
  );

  const getLanguageExtension = useCallback((lang: string): Extension => {
    switch (lang) {
      case 'cpp': return cpp();
      case 'markdown': return markdown();
      default: return javascript({ typescript: true });
    }
  }, []);

  // Create editor on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const extensions: Extension[] = [
      lineNumbers(),
      history(),
      bracketMatching(),
      indentOnInput(),
      autocompletion(),
      highlightSelectionMatches(),
      lintGutter(),
      languageCompartment.current.of(getLanguageExtension(language)),
      protoPulseTheme,
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
      readOnlyCompartment.current.of(EditorState.readOnly.of(readOnly)),
      linterCompartment.current.of(buildDiagnostics(errors)),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      }),
      ...customExtensions,
    ];

    const state = EditorState.create({
      doc: value,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: container,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount/unmount — value sync handled by the next effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: value,
        },
      });
    }
  }, [value]);

  // Sync readOnly prop
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: readOnlyCompartment.current.reconfigure(
        EditorState.readOnly.of(readOnly),
      ),
    });
  }, [readOnly]);

  // Sync language prop
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: languageCompartment.current.reconfigure(getLanguageExtension(language)),
    });
  }, [language, getLanguageExtension]);

  // Sync error diagnostics
  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: linterCompartment.current.reconfigure(buildDiagnostics(errors)),
    });
  }, [errors, buildDiagnostics]);

  // Expose goToLine via ref
  useImperativeHandle(ref, () => ({
    goToLine: (line: number) => {
      const view = viewRef.current;
      if (!view) {
        return;
      }
      const lineInfo = view.state.doc.line(Math.min(line, view.state.doc.lines));
      view.dispatch({
        selection: { anchor: lineInfo.from },
        scrollIntoView: true,
      });
      view.focus();
    },
  }), []);

  return (
    <div
      ref={containerRef}
      data-testid="circuit-code-editor"
      className={cn('h-full w-full overflow-hidden', className)}
    />
  );
});

export default CodeEditor;
