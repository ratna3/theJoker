/**
 * The Joker - Agentic Terminal
 * Vector Store
 *
 * In-memory vector database with cosine similarity search
 * and disk persistence. Zero external dependencies.
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

export interface VectorDocument {
  id: string;
  content: string;
  vector: number[];
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  filePath: string;
  language: string;
  type: 'function' | 'class' | 'block' | 'file' | 'import' | 'interface' | 'type' | 'other';
  name?: string;
  startLine?: number;
  endLine?: number;
  lastModified?: number;
  fileHash?: string;
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
  rank: number;
}

export interface VectorStoreStats {
  totalDocuments: number;
  totalFiles: number;
  dimensions: number;
  provider: string;
  lastIndexed: Date | null;
  storagePath: string;
}

export interface VectorStoreConfig {
  storagePath: string;
  maxResults?: number;
  minScore?: number;
}

// ============================================
// Vector Math Utilities
// ============================================

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ============================================
// Vector Store
// ============================================

/**
 * In-memory vector store with persistence.
 */
export class VectorStore {
  private documents: Map<string, VectorDocument> = new Map();
  private config: Required<VectorStoreConfig>;
  private lastIndexed: Date | null = null;
  private dimensions: number = 0;
  private provider: string = 'unknown';

  constructor(config: VectorStoreConfig) {
    this.config = {
      maxResults: 10,
      minScore: 0.1,
      ...config,
    };
  }

  // ── CRUD ──────────────────────────────────────────────

  /**
   * Add or update a document.
   */
  add(doc: VectorDocument): void {
    this.documents.set(doc.id, doc);
    if (this.dimensions === 0 && doc.vector.length > 0) {
      this.dimensions = doc.vector.length;
    }
  }

  /**
   * Add multiple documents.
   */
  addBatch(docs: VectorDocument[]): void {
    for (const doc of docs) {
      this.add(doc);
    }
  }

  /**
   * Remove a document by ID.
   */
  remove(id: string): boolean {
    return this.documents.delete(id);
  }

  /**
   * Remove all documents for a given file path.
   */
  removeByFile(filePath: string): number {
    const normalised = path.resolve(filePath);
    let count = 0;
    for (const [id, doc] of this.documents) {
      if (path.resolve(doc.metadata.filePath) === normalised) {
        this.documents.delete(id);
        count++;
      }
    }
    return count;
  }

  /**
   * Get a document by ID.
   */
  get(id: string): VectorDocument | undefined {
    return this.documents.get(id);
  }

  /**
   * Check if a document exists.
   */
  has(id: string): boolean {
    return this.documents.has(id);
  }

  /**
   * Clear all documents.
   */
  clear(): void {
    this.documents.clear();
    this.dimensions = 0;
  }

  // ── Search ────────────────────────────────────────────

  /**
   * Semantic search: find the most similar documents to a query vector.
   */
  search(queryVector: number[], maxResults?: number, minScore?: number): SearchResult[] {
    const limit = maxResults ?? this.config.maxResults;
    const threshold = minScore ?? this.config.minScore;

    const scored: SearchResult[] = [];

    for (const doc of this.documents.values()) {
      const score = cosineSimilarity(queryVector, doc.vector);
      if (score >= threshold) {
        scored.push({ document: doc, score, rank: 0 });
      }
    }

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // Assign ranks and trim
    return scored.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
  }

  /**
   * Search by file path pattern.
   */
  searchByFile(pattern: string): VectorDocument[] {
    const results: VectorDocument[] = [];
    const lowerPattern = pattern.toLowerCase();

    for (const doc of this.documents.values()) {
      if (doc.metadata.filePath.toLowerCase().includes(lowerPattern)) {
        results.push(doc);
      }
    }

    return results;
  }

  /**
   * Get all unique indexed file paths.
   */
  getIndexedFiles(): string[] {
    const files = new Set<string>();
    for (const doc of this.documents.values()) {
      files.add(doc.metadata.filePath);
    }
    return [...files];
  }

  // ── Metadata ──────────────────────────────────────────

  /**
   * Set the provider name (for stats).
   */
  setProvider(provider: string): void {
    this.provider = provider;
  }

  /**
   * Mark indexing as complete.
   */
  markIndexed(): void {
    this.lastIndexed = new Date();
  }

  /**
   * Get store statistics.
   */
  getStats(): VectorStoreStats {
    return {
      totalDocuments: this.documents.size,
      totalFiles: this.getIndexedFiles().length,
      dimensions: this.dimensions,
      provider: this.provider,
      lastIndexed: this.lastIndexed,
      storagePath: this.config.storagePath,
    };
  }

  // ── Persistence ───────────────────────────────────────

  /**
   * Save the store to disk.
   */
  async save(): Promise<void> {
    const dir = this.config.storagePath;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const data = {
      version: 1,
      dimensions: this.dimensions,
      provider: this.provider,
      lastIndexed: this.lastIndexed?.toISOString() || null,
      documents: [...this.documents.values()].map(doc => ({
        id: doc.id,
        content: doc.content,
        vector: doc.vector,
        metadata: doc.metadata,
      })),
    };

    const filePath = path.join(dir, 'vectorstore.json');
    fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');

    logger.info('Vector store saved', {
      path: filePath,
      documents: data.documents.length,
    });
  }

  /**
   * Load the store from disk.
   */
  async load(): Promise<boolean> {
    const filePath = path.join(this.config.storagePath, 'vectorstore.json');

    if (!fs.existsSync(filePath)) {
      logger.debug('No vector store found on disk', { path: filePath });
      return false;
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);

      if (data.version !== 1) {
        logger.warn('Incompatible vector store version', { version: data.version });
        return false;
      }

      this.dimensions = data.dimensions || 0;
      this.provider = data.provider || 'unknown';
      this.lastIndexed = data.lastIndexed ? new Date(data.lastIndexed) : null;

      this.documents.clear();
      for (const doc of data.documents) {
        this.documents.set(doc.id, {
          id: doc.id,
          content: doc.content,
          vector: doc.vector,
          metadata: doc.metadata,
        });
      }

      logger.info('Vector store loaded', {
        documents: this.documents.size,
        dimensions: this.dimensions,
      });

      return true;
    } catch (error) {
      logger.error('Failed to load vector store', { error: (error as Error).message });
      return false;
    }
  }
}
