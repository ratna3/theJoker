/**
 * The Joker - Agentic Terminal
 * Embedding Provider
 *
 * Generates vector embeddings for text using:
 * 1. LM Studio /v1/embeddings endpoint (primary)
 * 2. TF-IDF fallback when embeddings endpoint unavailable
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

// ============================================
// Types
// ============================================

export interface EmbeddingResult {
  vector: number[];
  dimensions: number;
  model: string;
  provider: 'llm' | 'tfidf';
}

export interface EmbeddingConfig {
  baseUrl: string;
  model?: string;
  dimensions?: number;
  timeout?: number;
  batchSize?: number;
}

// ============================================
// TF-IDF Fallback
// ============================================

/**
 * Lightweight TF-IDF implementation for when LLM embeddings are unavailable.
 * Builds a vocabulary from the corpus and produces fixed-dimensional vectors.
 */
export class TFIDFEmbedder {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private documentCount: number = 0;
  private dimensions: number;
  private frozen: boolean = false;

  constructor(dimensions: number = 384) {
    this.dimensions = dimensions;
  }

  /**
   * Tokenise text into lowercased alphanumeric tokens.
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9_\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  /**
   * Build vocabulary from a batch of documents (call once before embedding).
   */
  buildVocabulary(documents: string[]): void {
    this.documentCount = documents.length;
    const docFrequency = new Map<string, number>();

    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc));
      for (const token of tokens) {
        docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
      }
    }

    // Pick the top N tokens by document frequency (deterministic)
    const sorted = [...docFrequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, this.dimensions);

    this.vocabulary.clear();
    this.idf.clear();

    sorted.forEach(([token, df], index) => {
      this.vocabulary.set(token, index);
      this.idf.set(token, Math.log((this.documentCount + 1) / (df + 1)) + 1);
    });

    this.frozen = true;
    logger.debug('TF-IDF vocabulary built', {
      vocabSize: this.vocabulary.size,
      documents: this.documentCount,
    });
  }

  /**
   * Embed a single document into a fixed-dimension vector.
   */
  embed(text: string): number[] {
    const vector = new Array<number>(this.dimensions).fill(0);
    const tokens = this.tokenize(text);
    if (tokens.length === 0) return vector;

    // Term frequency
    const tf = new Map<string, number>();
    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);
    }

    // TF-IDF vector
    for (const [token, freq] of tf) {
      const index = this.vocabulary.get(token);
      if (index !== undefined) {
        const idfScore = this.idf.get(token) || 1;
        vector[index] = (freq / tokens.length) * idfScore;
      }
    }

    // L2 normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  /**
   * Serialise vocabulary for persistence.
   */
  serialize(): { vocabulary: [string, number][]; idf: [string, number][]; documentCount: number; dimensions: number } {
    return {
      vocabulary: [...this.vocabulary.entries()],
      idf: [...this.idf.entries()],
      documentCount: this.documentCount,
      dimensions: this.dimensions,
    };
  }

  /**
   * Restore from serialised data.
   */
  static deserialize(data: ReturnType<TFIDFEmbedder['serialize']>): TFIDFEmbedder {
    const embedder = new TFIDFEmbedder(data.dimensions);
    embedder.vocabulary = new Map(data.vocabulary);
    embedder.idf = new Map(data.idf);
    embedder.documentCount = data.documentCount;
    embedder.frozen = true;
    return embedder;
  }
}

// ============================================
// Embedding Provider
// ============================================

/**
 * Embedding provider that tries the LLM embeddings endpoint first,
 * then falls back to local TF-IDF.
 */
export class EmbeddingProvider {
  private client: AxiosInstance;
  private config: EmbeddingConfig;
  private tfidf: TFIDFEmbedder;
  private llmAvailable: boolean | null = null; // null = untested

  constructor(config: EmbeddingConfig) {
    this.config = {
      dimensions: 384,
      timeout: 30000,
      batchSize: 32,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
    });

    this.tfidf = new TFIDFEmbedder(this.config.dimensions!);
  }

  /**
   * Test whether the LLM embeddings endpoint is available.
   */
  async testLLMEmbeddings(): Promise<boolean> {
    try {
      const response = await this.client.post('/v1/embeddings', {
        model: this.config.model || 'default',
        input: 'test',
      }, { timeout: 10000 });

      if (response.data?.data?.[0]?.embedding) {
        this.llmAvailable = true;
        this.config.dimensions = response.data.data[0].embedding.length;
        logger.info('LLM embeddings endpoint available', {
          dimensions: this.config.dimensions,
        });
        return true;
      }
    } catch {
      // Endpoint not available
    }

    this.llmAvailable = false;
    logger.info('LLM embeddings not available, using TF-IDF fallback');
    return false;
  }

  /**
   * Get the active provider name.
   */
  getProvider(): 'llm' | 'tfidf' {
    return this.llmAvailable ? 'llm' : 'tfidf';
  }

  /**
   * Embed a single text.
   */
  async embed(text: string): Promise<EmbeddingResult> {
    // Auto-detect on first call
    if (this.llmAvailable === null) {
      await this.testLLMEmbeddings();
    }

    if (this.llmAvailable) {
      return this.embedViaLLM(text);
    }

    return {
      vector: this.tfidf.embed(text),
      dimensions: this.config.dimensions!,
      model: 'tfidf-local',
      provider: 'tfidf',
    };
  }

  /**
   * Embed multiple texts in batches.
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (this.llmAvailable === null) {
      await this.testLLMEmbeddings();
    }

    if (this.llmAvailable) {
      return this.embedBatchViaLLM(texts);
    }

    return texts.map(text => ({
      vector: this.tfidf.embed(text),
      dimensions: this.config.dimensions!,
      model: 'tfidf-local',
      provider: 'tfidf',
    }));
  }

  /**
   * Build TF-IDF vocabulary (must call before using TF-IDF fallback).
   */
  buildTFIDFVocabulary(documents: string[]): void {
    this.tfidf.buildVocabulary(documents);
  }

  /**
   * Get the TF-IDF embedder (for serialization).
   */
  getTFIDF(): TFIDFEmbedder {
    return this.tfidf;
  }

  /**
   * Set a pre-built TF-IDF embedder (for deserialization).
   */
  setTFIDF(tfidf: TFIDFEmbedder): void {
    this.tfidf = tfidf;
  }

  /**
   * Get the configured dimensions.
   */
  getDimensions(): number {
    return this.config.dimensions!;
  }

  // ── Private ────────────────────────────────────────────

  private async embedViaLLM(text: string): Promise<EmbeddingResult> {
    const response = await this.client.post('/v1/embeddings', {
      model: this.config.model || 'default',
      input: text,
    });

    const embedding = response.data.data[0].embedding;
    return {
      vector: embedding,
      dimensions: embedding.length,
      model: response.data.model || this.config.model || 'unknown',
      provider: 'llm',
    };
  }

  private async embedBatchViaLLM(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    const batchSize = this.config.batchSize!;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);

      try {
        const response = await this.client.post('/v1/embeddings', {
          model: this.config.model || 'default',
          input: batch,
        });

        for (const item of response.data.data) {
          results.push({
            vector: item.embedding,
            dimensions: item.embedding.length,
            model: response.data.model || this.config.model || 'unknown',
            provider: 'llm',
          });
        }
      } catch (error) {
        // Fallback to individual requests on batch failure
        logger.warn('Batch embedding failed, falling back to individual', {
          batchStart: i,
          batchSize: batch.length,
        });

        for (const text of batch) {
          try {
            results.push(await this.embedViaLLM(text));
          } catch {
            // Final fallback to TF-IDF for this item
            results.push({
              vector: this.tfidf.embed(text),
              dimensions: this.config.dimensions!,
              model: 'tfidf-local',
              provider: 'tfidf',
            });
          }
        }
      }
    }

    return results;
  }
}
