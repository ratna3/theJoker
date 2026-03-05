/**
 * The Joker - Agentic Terminal
 * Vector Store Module Exports
 */

export { EmbeddingProvider, TFIDFEmbedder } from './embeddings';
export type { EmbeddingResult, EmbeddingConfig } from './embeddings';

export { VectorStore } from './store';
export type { VectorDocument, DocumentMetadata, SearchResult, VectorStoreStats, VectorStoreConfig } from './store';

export { CodebaseIndexer } from './indexer';
export type { IndexerConfig, IndexResult } from './indexer';

// ── Singleton Instance ──────────────────────────────────
import { EmbeddingProvider } from './embeddings';
import { VectorStore } from './store';
import { CodebaseIndexer } from './indexer';

export interface VectorStoreInstance {
  embeddings: EmbeddingProvider;
  store: VectorStore;
  indexer: CodebaseIndexer;
}

let _instance: VectorStoreInstance | null = null;

/**
 * Initialize the global vector store instance.
 * Call once during application startup.
 */
export function initVectorStore(storagePath: string, llmBaseUrl: string): VectorStoreInstance {
  const embeddings = new EmbeddingProvider({ baseUrl: llmBaseUrl });
  const store = new VectorStore({ storagePath });
  const indexer = new CodebaseIndexer(embeddings, store);
  _instance = { embeddings, store, indexer };
  return _instance;
}

/**
 * Get the global vector store instance (or null if not initialized).
 */
export function getVectorStoreInstance(): VectorStoreInstance | null {
  return _instance;
}
