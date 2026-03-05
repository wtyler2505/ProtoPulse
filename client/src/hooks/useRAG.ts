import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { RAGEngine } from '@/lib/rag-engine';
import type { RAGResult, RAGDocument } from '@/lib/rag-engine';
import { getKnowledgeDocuments } from '@/lib/rag-knowledge-base';

export type { RAGResult };

export interface UseRAGReturn {
  search: (query: string) => RAGResult[];
  addDocument: (doc: Omit<RAGDocument, 'chunks'>) => RAGDocument;
  removeDocument: (id: string) => boolean;
  documentCount: number;
  isIndexing: boolean;
  getContext: (query: string) => string;
}

export function useRAG(): UseRAGReturn {
  const engineRef = useRef<RAGEngine | null>(null);
  const [documentCount, setDocumentCount] = useState(0);
  const [isIndexing, setIsIndexing] = useState(false);
  const loadedRef = useRef(false);

  // Initialize engine once
  if (!engineRef.current) {
    engineRef.current = RAGEngine.getInstance();
  }

  const engine = engineRef.current;

  // Subscribe to engine state changes
  useEffect(() => {
    const unsubscribe = engine.subscribe(() => {
      setDocumentCount(engine.documentCount);
      setIsIndexing(engine.isIndexing);
    });

    // Sync initial state
    setDocumentCount(engine.documentCount);
    setIsIndexing(engine.isIndexing);

    return unsubscribe;
  }, [engine]);

  // Load built-in knowledge base on first use
  useEffect(() => {
    if (loadedRef.current) {
      return;
    }
    loadedRef.current = true;

    // Load persisted user documents
    engine.loadFromStorage();

    // Load built-in knowledge if not already present
    const builtIn = getKnowledgeDocuments();
    for (const doc of builtIn) {
      if (!engine.getDocument(doc.id)) {
        engine.addDocument(doc);
      }
    }
  }, [engine]);

  const search = useCallback(
    (query: string): RAGResult[] => {
      return engine.search(query);
    },
    [engine],
  );

  const addDocument = useCallback(
    (doc: Omit<RAGDocument, 'chunks'>): RAGDocument => {
      return engine.addDocument(doc);
    },
    [engine],
  );

  const removeDocument = useCallback(
    (id: string): boolean => {
      return engine.removeDocument(id);
    },
    [engine],
  );

  const getContext = useCallback(
    (query: string): string => {
      return engine.getContext(query);
    },
    [engine],
  );

  return useMemo(
    () => ({
      search,
      addDocument,
      removeDocument,
      documentCount,
      isIndexing,
      getContext,
    }),
    [search, addDocument, removeDocument, documentCount, isIndexing, getContext],
  );
}
