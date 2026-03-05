// ---------------------------------------------------------------------------
// RAG Engine — Retrieval-Augmented Generation for electronics knowledge
// ---------------------------------------------------------------------------

// ---- Public types ---------------------------------------------------------

export interface RAGChunk {
  id: string;
  documentId: string;
  content: string;
  tokens: string[];
  tfidf: Map<string, number>;
}

export interface RAGDocument {
  id: string;
  title: string;
  source: string;
  content: string;
  chunks: RAGChunk[];
  metadata: Record<string, string>;
}

export interface RAGResult {
  chunk: RAGChunk;
  score: number;
  document: RAGDocument;
}

export interface RAGEngineOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  scoreThreshold?: number;
  maxContextChars?: number;
}

type RAGSubscriber = () => void;

// ---- Stop words -----------------------------------------------------------

const STOP_WORDS = new Set([
  // Common English
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'it', 'its',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we',
  'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
  'our', 'their', 'what', 'which', 'who', 'whom', 'when', 'where',
  'why', 'how', 'not', 'no', 'nor', 'if', 'then', 'than', 'so',
  'very', 'just', 'about', 'also', 'more', 'some', 'any', 'each',
  'every', 'all', 'both', 'few', 'most', 'other', 'such', 'only',
  'same', 'as', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'up', 'down', 'out', 'off', 'over', 'under',
  'again', 'further', 'once', 'here', 'there', 'too',
  // Electronics domain stop words (too generic to be useful for retrieval)
  'circuit', 'component', 'pin', 'used', 'using', 'use',
]);

// ---- Helpers --------------------------------------------------------------

let chunkCounter = 0;

function generateChunkId(): string {
  chunkCounter += 1;
  return `chunk-${Date.now()}-${chunkCounter}`;
}

/** Lowercase, strip punctuation, split on whitespace, remove stop words. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_/.]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Split text into overlapping chunks. Prefers paragraph then sentence
 * boundaries before falling back to character-limit splitting.
 */
export function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  if (text.length <= chunkSize) {
    return [text.trim()].filter(Boolean);
  }

  // Split into paragraphs first
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);

  // Accumulate paragraphs into chunks respecting chunkSize
  const rawChunks: string[] = [];
  let buffer = '';

  for (const para of paragraphs) {
    // If a single paragraph exceeds chunkSize, split it by sentences
    if (para.length > chunkSize) {
      if (buffer.trim()) {
        rawChunks.push(buffer.trim());
        buffer = '';
      }
      const sentences = para.split(/(?<=[.!?])\s+/);
      let sentBuf = '';
      for (const sent of sentences) {
        // If a single sentence exceeds chunkSize, split by word/character boundary
        if (sent.length > chunkSize) {
          if (sentBuf.trim()) {
            rawChunks.push(sentBuf.trim());
            sentBuf = '';
          }
          const words = sent.split(/\s+/);
          let wordBuf = '';
          for (const word of words) {
            if (wordBuf.length + word.length + 1 > chunkSize && wordBuf.trim()) {
              rawChunks.push(wordBuf.trim());
              wordBuf = overlap > 0 ? wordBuf.slice(-overlap) : '';
            }
            wordBuf += (wordBuf ? ' ' : '') + word;
          }
          if (wordBuf.trim()) {
            sentBuf = wordBuf;
          }
          continue;
        }
        if (sentBuf.length + sent.length + 1 > chunkSize && sentBuf.trim()) {
          rawChunks.push(sentBuf.trim());
          // Overlap: keep tail of previous chunk
          sentBuf = overlap > 0 ? sentBuf.slice(-overlap) : '';
        }
        sentBuf += (sentBuf ? ' ' : '') + sent;
      }
      if (sentBuf.trim()) {
        rawChunks.push(sentBuf.trim());
      }
      continue;
    }

    // Would adding this paragraph exceed the limit?
    if (buffer.length + para.length + 2 > chunkSize && buffer.trim()) {
      rawChunks.push(buffer.trim());
      // Overlap: keep tail of previous chunk
      buffer = overlap > 0 ? buffer.slice(-overlap) : '';
    }
    buffer += (buffer ? '\n\n' : '') + para;
  }

  if (buffer.trim()) {
    rawChunks.push(buffer.trim());
  }

  return rawChunks;
}

/** Cosine similarity between two sparse TF-IDF vectors. */
export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const [term, weightA] of Array.from(a.entries())) {
    magA += weightA * weightA;
    const weightB = b.get(term);
    if (weightB !== undefined) {
      dot += weightA * weightB;
    }
  }

  for (const [, weightB] of Array.from(b.entries())) {
    magB += weightB * weightB;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) {
    return 0;
  }
  return dot / denom;
}

// ---- Storage key ----------------------------------------------------------

const STORAGE_KEY = 'protopulse-rag-documents';

// ---- RAGEngine class ------------------------------------------------------

export class RAGEngine {
  private static instance: RAGEngine | null = null;

  private documents: Map<string, RAGDocument> = new Map();
  private allChunks: RAGChunk[] = [];
  /** Number of chunks containing each term (for IDF). */
  private documentFrequency: Map<string, number> = new Map();
  private subscribers: Set<RAGSubscriber> = new Set();
  private _isIndexing = false;

  // Config
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly topK: number;
  readonly scoreThreshold: number;
  readonly maxContextChars: number;

  constructor(options: RAGEngineOptions = {}) {
    this.chunkSize = options.chunkSize ?? 500;
    this.chunkOverlap = options.chunkOverlap ?? 100;
    this.topK = options.topK ?? 5;
    this.scoreThreshold = options.scoreThreshold ?? 0.1;
    this.maxContextChars = options.maxContextChars ?? 2000;
  }

  // ---- Singleton ----------------------------------------------------------

  static getInstance(options?: RAGEngineOptions): RAGEngine {
    if (!RAGEngine.instance) {
      RAGEngine.instance = new RAGEngine(options);
    }
    return RAGEngine.instance;
  }

  static resetInstance(): void {
    RAGEngine.instance = null;
  }

  // ---- Pub/sub ------------------------------------------------------------

  subscribe(fn: RAGSubscriber): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify(): void {
    for (const fn of Array.from(this.subscribers)) {
      fn();
    }
  }

  // ---- Accessors ----------------------------------------------------------

  get documentCount(): number {
    return this.documents.size;
  }

  get isIndexing(): boolean {
    return this._isIndexing;
  }

  getDocument(id: string): RAGDocument | undefined {
    return this.documents.get(id);
  }

  getAllDocuments(): RAGDocument[] {
    return Array.from(this.documents.values());
  }

  // ---- Document CRUD ------------------------------------------------------

  addDocument(doc: Omit<RAGDocument, 'chunks'>): RAGDocument {
    this._isIndexing = true;
    this.notify();

    try {
      // Chunk the content
      const textChunks = chunkText(doc.content, this.chunkSize, this.chunkOverlap);

      const chunks: RAGChunk[] = textChunks.map((text) => {
        const tokens = tokenize(text);
        return {
          id: generateChunkId(),
          documentId: doc.id,
          content: text,
          tokens,
          tfidf: new Map(), // Computed after all chunks registered
        };
      });

      const fullDoc: RAGDocument = { ...doc, chunks };
      this.documents.set(doc.id, fullDoc);

      // Register chunks
      for (const chunk of chunks) {
        this.allChunks.push(chunk);
      }

      // Rebuild IDF and TF-IDF vectors
      this.rebuildIndex();
      this.persist();
      return fullDoc;
    } finally {
      this._isIndexing = false;
      this.notify();
    }
  }

  removeDocument(id: string): boolean {
    const doc = this.documents.get(id);
    if (!doc) {
      return false;
    }

    this.documents.delete(id);
    this.allChunks = this.allChunks.filter((c) => c.documentId !== id);
    this.rebuildIndex();
    this.persist();
    this.notify();
    return true;
  }

  // ---- Indexing ------------------------------------------------------------

  private rebuildIndex(): void {
    // Recompute document frequency
    this.documentFrequency.clear();
    const totalChunks = this.allChunks.length;

    for (const chunk of this.allChunks) {
      const uniqueTerms = new Set(chunk.tokens);
      for (const term of Array.from(uniqueTerms)) {
        this.documentFrequency.set(term, (this.documentFrequency.get(term) ?? 0) + 1);
      }
    }

    // Recompute TF-IDF for every chunk
    for (const chunk of this.allChunks) {
      chunk.tfidf = this.computeTFIDF(chunk.tokens, totalChunks);
    }
  }

  private computeTFIDF(tokens: string[], totalChunks: number): Map<string, number> {
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) ?? 0) + 1);
    }

    const tfidf = new Map<string, number>();
    const tokenCount = tokens.length;
    if (tokenCount === 0) {
      return tfidf;
    }

    for (const [term, count] of Array.from(tf.entries())) {
      const termFreq = count / tokenCount;
      const df = this.documentFrequency.get(term) ?? 0;
      // Smoothed IDF: log(1 + totalChunks / (1 + df)) avoids zero when totalChunks == df
      const idf = Math.log(1 + totalChunks / (1 + df));
      tfidf.set(term, termFreq * idf);
    }
    return tfidf;
  }

  // ---- Query --------------------------------------------------------------

  search(query: string, topK?: number, threshold?: number): RAGResult[] {
    const k = topK ?? this.topK;
    const minScore = threshold ?? this.scoreThreshold;

    if (!query.trim() || this.allChunks.length === 0) {
      return [];
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    const queryVector = this.computeTFIDF(queryTokens, this.allChunks.length);

    const results: RAGResult[] = [];
    for (const chunk of this.allChunks) {
      const score = cosineSimilarity(queryVector, chunk.tfidf);
      if (score >= minScore) {
        const doc = this.documents.get(chunk.documentId);
        if (doc) {
          results.push({ chunk, score, document: doc });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  getContext(query: string, maxChars?: number): string {
    const limit = maxChars ?? this.maxContextChars;
    const results = this.search(query);

    if (results.length === 0) {
      return '';
    }

    const parts: string[] = [];
    let currentLength = 0;

    for (const result of results) {
      const attribution = `[Source: ${result.document.title}]`;
      const entry = `${attribution}\n${result.chunk.content}`;

      if (currentLength + entry.length + 2 > limit && parts.length > 0) {
        break;
      }

      parts.push(entry);
      currentLength += entry.length + 2; // +2 for separator
    }

    return parts.join('\n\n');
  }

  // ---- Persistence --------------------------------------------------------

  private persist(): void {
    try {
      const serializable = Array.from(this.documents.values()).map((doc) => ({
        id: doc.id,
        title: doc.title,
        source: doc.source,
        content: doc.content,
        metadata: doc.metadata,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
    } catch {
      // localStorage may be unavailable or full — silently degrade
    }
  }

  loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const docs = JSON.parse(raw) as Array<{
        id: string;
        title: string;
        source: string;
        content: string;
        metadata: Record<string, string>;
      }>;

      for (const doc of docs) {
        if (!this.documents.has(doc.id)) {
          this.addDocument(doc);
        }
      }
    } catch {
      // Corrupt data — start fresh
    }
  }

  // ---- Reset (for tests) --------------------------------------------------

  clear(): void {
    this.documents.clear();
    this.allChunks = [];
    this.documentFrequency.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    this.notify();
  }
}
