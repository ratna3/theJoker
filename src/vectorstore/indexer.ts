/**
 * The Joker - Agentic Terminal
 * Codebase Indexer
 *
 * Walks a project directory, chunks code by logical boundaries
 * (functions, classes, blocks), generates embeddings, and stores
 * them in the VectorStore for semantic search.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { EmbeddingProvider, TFIDFEmbedder } from './embeddings';
import { VectorStore, VectorDocument, DocumentMetadata } from './store';

// ============================================
// Types
// ============================================

export interface IndexerConfig {
  /** Glob patterns to ignore (gitignore-style). */
  ignorePatterns: string[];
  /** Max file size in bytes to index (default 512KB). */
  maxFileSize: number;
  /** File extensions to index. */
  extensions: string[];
  /** Chunk target size in characters. */
  chunkSize: number;
  /** Chunk overlap in characters. */
  chunkOverlap: number;
}

export interface IndexResult {
  totalFiles: number;
  totalChunks: number;
  skippedFiles: number;
  errors: string[];
  durationMs: number;
  provider: string;
}

interface FileChunk {
  content: string;
  metadata: DocumentMetadata;
}

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: IndexerConfig = {
  ignorePatterns: [
    'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
    '.next', '.nuxt', '__pycache__', '.venv', 'venv',
    '.joker_memory', '.joker_vectorstore', 'logs',
    '*.min.js', '*.min.css', '*.map', '*.lock',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  ],
  maxFileSize: 512 * 1024, // 512 KB
  extensions: [
    '.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go',
    '.java', '.c', '.cpp', '.h', '.hpp', '.cs',
    '.rb', '.php', '.swift', '.kt', '.scala',
    '.json', '.yaml', '.yml', '.toml',
    '.md', '.txt', '.html', '.css', '.scss',
    '.sql', '.sh', '.bash', '.ps1',
    '.dockerfile', '.env.example',
  ],
  chunkSize: 1500,
  chunkOverlap: 200,
};

// ============================================
// Language Detection
// ============================================

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.rs': 'rust', '.go': 'go',
  '.java': 'java', '.c': 'c', '.cpp': 'cpp',
  '.h': 'c', '.hpp': 'cpp', '.cs': 'csharp',
  '.rb': 'ruby', '.php': 'php', '.swift': 'swift',
  '.kt': 'kotlin', '.scala': 'scala',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
  '.toml': 'toml', '.md': 'markdown', '.txt': 'text',
  '.html': 'html', '.css': 'css', '.scss': 'scss',
  '.sql': 'sql', '.sh': 'shell', '.bash': 'shell',
  '.ps1': 'powershell', '.dockerfile': 'dockerfile',
};

// ============================================
// Codebase Indexer
// ============================================

/**
 * Walks a directory tree, chunks files, and indexes them
 * in the vector store.
 */
export class CodebaseIndexer extends EventEmitter {
  private embeddingProvider: EmbeddingProvider;
  private store: VectorStore;
  private config: IndexerConfig;
  private fileHashes: Map<string, string> = new Map();

  constructor(
    embeddingProvider: EmbeddingProvider,
    store: VectorStore,
    config?: Partial<IndexerConfig>,
  ) {
    super();
    this.embeddingProvider = embeddingProvider;
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── Public API ────────────────────────────────────────

  /**
   * Index an entire directory (full or incremental).
   */
  async indexDirectory(dirPath: string, incremental: boolean = true): Promise<IndexResult> {
    const startTime = Date.now();
    const resolvedDir = path.resolve(dirPath);

    logger.info('Starting codebase indexing', { dir: resolvedDir, incremental });
    this.emit('index:start', { dir: resolvedDir });

    // Load existing store for incremental indexing
    if (incremental) {
      await this.store.load();
      this.rebuildHashMap();
    } else {
      this.store.clear();
      this.fileHashes.clear();
    }

    // Discover files
    const files = this.walkDirectory(resolvedDir);
    this.emit('index:files-discovered', { count: files.length });

    // Chunk files
    const allChunks: FileChunk[] = [];
    let skippedFiles = 0;
    const errors: string[] = [];

    for (const filePath of files) {
      try {
        const fileHash = this.hashFile(filePath);

        // Skip unchanged files in incremental mode
        if (incremental && this.fileHashes.get(filePath) === fileHash) {
          continue;
        }

        // Remove old chunks for this file if re-indexing
        if (incremental) {
          this.store.removeByFile(filePath);
        }

        const chunks = this.chunkFile(filePath);
        for (const chunk of chunks) {
          chunk.metadata.fileHash = fileHash;
        }
        allChunks.push(...chunks);
        this.fileHashes.set(filePath, fileHash);
      } catch (error) {
        skippedFiles++;
        errors.push(`${filePath}: ${(error as Error).message}`);
      }
    }

    if (allChunks.length === 0) {
      logger.info('No new or changed files to index');
      this.store.markIndexed();
      return {
        totalFiles: files.length,
        totalChunks: 0,
        skippedFiles,
        errors,
        durationMs: Date.now() - startTime,
        provider: this.embeddingProvider.getProvider(),
      };
    }

    // Build TF-IDF vocabulary if using fallback
    const allTexts = allChunks.map(c => c.content);
    this.embeddingProvider.buildTFIDFVocabulary(allTexts);

    // Generate embeddings
    this.emit('index:embedding', { chunks: allChunks.length });

    const embeddings = await this.embeddingProvider.embedBatch(allTexts);

    // Store documents
    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      const embedding = embeddings[i];

      const doc: VectorDocument = {
        id: this.generateChunkId(chunk.metadata.filePath, i),
        content: chunk.content,
        vector: embedding.vector,
        metadata: chunk.metadata,
      };

      this.store.add(doc);
    }

    // Persist
    this.store.setProvider(this.embeddingProvider.getProvider());
    this.store.markIndexed();
    await this.store.save();
    await this.saveHashMap(dirPath);

    // Save TF-IDF vocabulary if used
    if (this.embeddingProvider.getProvider() === 'tfidf') {
      this.saveTFIDF(dirPath);
    }

    const result: IndexResult = {
      totalFiles: files.length,
      totalChunks: allChunks.length,
      skippedFiles,
      errors,
      durationMs: Date.now() - startTime,
      provider: this.embeddingProvider.getProvider(),
    };

    logger.info('Codebase indexing complete', result);
    this.emit('index:complete', result);

    return result;
  }

  // ── File Walking ──────────────────────────────────────

  /**
   * Recursively walk a directory and return indexable file paths.
   */
  private walkDirectory(dirPath: string): string[] {
    const results: string[] = [];

    const walk = (currentDir: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        // Check ignore patterns
        if (this.shouldIgnore(entry.name, fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!this.config.extensions.includes(ext)) continue;

          // Check file size
          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > this.config.maxFileSize) continue;
            if (stat.size === 0) continue;
          } catch {
            continue;
          }

          results.push(fullPath);
        }
      }
    };

    walk(dirPath);
    return results;
  }

  /**
   * Check if a file/directory should be ignored.
   */
  private shouldIgnore(name: string, fullPath: string): boolean {
    for (const pattern of this.config.ignorePatterns) {
      // Direct name match
      if (name === pattern) return true;
      // Wildcard extension match (e.g. *.min.js)
      if (pattern.startsWith('*') && name.endsWith(pattern.slice(1))) return true;
      // Path contains pattern
      if (fullPath.includes(path.sep + pattern + path.sep)) return true;
    }

    // Always ignore dot-directories except .env.example
    if (name.startsWith('.') && name !== '.env.example') return true;

    return false;
  }

  // ── Chunking ──────────────────────────────────────────

  /**
   * Chunk a file into logical blocks.
   */
  private chunkFile(filePath: string): FileChunk[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    const language = EXTENSION_TO_LANGUAGE[ext] || 'unknown';

    // For small files, index as a single chunk
    if (content.length <= this.config.chunkSize) {
      return [{
        content,
        metadata: {
          filePath,
          language,
          type: 'file',
          startLine: 1,
          endLine: content.split('\n').length,
          lastModified: fs.statSync(filePath).mtimeMs,
        },
      }];
    }

    // Try structural chunking for supported languages
    if (['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'csharp'].includes(language)) {
      const structural = this.structuralChunk(content, filePath, language);
      if (structural.length > 0) return structural;
    }

    // Fall back to sliding window
    return this.slidingWindowChunk(content, filePath, language);
  }

  /**
   * Structural chunking: split by function/class boundaries.
   */
  private structuralChunk(content: string, filePath: string, language: string): FileChunk[] {
    const lines = content.split('\n');
    const chunks: FileChunk[] = [];

    // Patterns for function/class/interface boundaries
    const patterns = this.getBoundaryPatterns(language);
    const boundaries: number[] = [0];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          boundaries.push(i);
          break;
        }
      }
    }

    // Ensure we process until the end
    boundaries.push(lines.length);

    // Merge small adjacent boundaries into chunks
    let chunkStart = 0;
    let chunkLines: string[] = [];

    for (let b = 1; b < boundaries.length; b++) {
      const segmentLines = lines.slice(boundaries[b - 1], boundaries[b]);
      const segmentText = segmentLines.join('\n');

      if (chunkLines.join('\n').length + segmentText.length > this.config.chunkSize && chunkLines.length > 0) {
        // Emit current chunk
        const chunkContent = chunkLines.join('\n');
        if (chunkContent.trim().length > 0) {
          chunks.push({
            content: chunkContent,
            metadata: {
              filePath,
              language,
              type: this.detectBlockType(chunkContent),
              name: this.extractBlockName(chunkContent),
              startLine: chunkStart + 1,
              endLine: chunkStart + chunkLines.length,
              lastModified: fs.statSync(filePath).mtimeMs,
            },
          });
        }

        chunkStart = boundaries[b - 1];
        chunkLines = [...segmentLines];
      } else {
        chunkLines.push(...segmentLines);
      }
    }

    // Emit remaining chunk
    if (chunkLines.length > 0) {
      const chunkContent = chunkLines.join('\n');
      if (chunkContent.trim().length > 0) {
        chunks.push({
          content: chunkContent,
          metadata: {
            filePath,
            language,
            type: this.detectBlockType(chunkContent),
            name: this.extractBlockName(chunkContent),
            startLine: chunkStart + 1,
            endLine: chunkStart + chunkLines.length,
            lastModified: fs.statSync(filePath).mtimeMs,
          },
        });
      }
    }

    return chunks;
  }

  /**
   * Sliding window chunking with overlap.
   */
  private slidingWindowChunk(content: string, filePath: string, language: string): FileChunk[] {
    const chunks: FileChunk[] = [];
    const lines = content.split('\n');
    let startIdx = 0;

    while (startIdx < content.length) {
      const endIdx = Math.min(startIdx + this.config.chunkSize, content.length);
      const chunkContent = content.slice(startIdx, endIdx);
      const startLine = content.slice(0, startIdx).split('\n').length;
      const endLine = startLine + chunkContent.split('\n').length - 1;

      if (chunkContent.trim().length > 0) {
        chunks.push({
          content: chunkContent,
          metadata: {
            filePath,
            language,
            type: 'block',
            startLine,
            endLine,
            lastModified: fs.statSync(filePath).mtimeMs,
          },
        });
      }

      startIdx = endIdx - this.config.chunkOverlap;
      if (startIdx >= content.length) break;
      // Prevent infinite loop
      if (endIdx === content.length) break;
    }

    return chunks;
  }

  /**
   * Get regex patterns for function/class boundaries by language.
   */
  private getBoundaryPatterns(language: string): RegExp[] {
    switch (language) {
      case 'typescript':
      case 'javascript':
        return [
          /^(export\s+)?(async\s+)?function\s+/,
          /^(export\s+)?(default\s+)?class\s+/,
          /^(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s+)?\(.*\)\s*(:\s*\w+)?\s*=>/,
          /^(export\s+)?interface\s+/,
          /^(export\s+)?type\s+\w+\s*=/,
          /^(export\s+)?enum\s+/,
        ];
      case 'python':
        return [
          /^(async\s+)?def\s+/,
          /^class\s+/,
        ];
      case 'java':
      case 'csharp':
        return [
          /^\s*(public|private|protected|static|abstract|final|override|virtual|async)\s+.*\{/,
          /^\s*class\s+/,
          /^\s*interface\s+/,
        ];
      case 'go':
        return [
          /^func\s+/,
          /^type\s+\w+\s+struct/,
          /^type\s+\w+\s+interface/,
        ];
      case 'rust':
        return [
          /^(pub\s+)?(async\s+)?fn\s+/,
          /^(pub\s+)?struct\s+/,
          /^(pub\s+)?enum\s+/,
          /^(pub\s+)?trait\s+/,
          /^impl\s+/,
        ];
      default:
        return [];
    }
  }

  /**
   * Detect the type of a code block.
   */
  private detectBlockType(content: string): DocumentMetadata['type'] {
    const firstLine = content.trimStart().split('\n')[0] || '';
    if (/class\s+/.test(firstLine)) return 'class';
    if (/function\s+|=>\s*{|=>\s*\(/.test(firstLine)) return 'function';
    if (/interface\s+/.test(firstLine)) return 'interface';
    if (/type\s+\w+\s*=/.test(firstLine)) return 'type';
    if (/^import\s+/.test(firstLine)) return 'import';
    return 'block';
  }

  /**
   * Extract a name from a code block's first significant line.
   */
  private extractBlockName(content: string): string | undefined {
    const firstLine = content.trimStart().split('\n')[0] || '';
    const match = firstLine.match(
      /(?:class|function|interface|type|enum|struct|trait|impl|fn|def)\s+(\w+)/
    );
    return match?.[1];
  }

  // ── Hashing ───────────────────────────────────────────

  /**
   * SHA-256 hash of a file for incremental indexing.
   */
  private hashFile(filePath: string): string {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Generate a deterministic chunk ID.
   */
  private generateChunkId(filePath: string, chunkIndex: number): string {
    const hash = crypto
      .createHash('sha256')
      .update(`${filePath}:${chunkIndex}`)
      .digest('hex')
      .slice(0, 12);
    return `chunk_${hash}`;
  }

  /**
   * Rebuild hash map from existing store documents.
   */
  private rebuildHashMap(): void {
    this.fileHashes.clear();
    for (const file of this.store.getIndexedFiles()) {
      const docs = this.store.searchByFile(file);
      if (docs.length > 0 && docs[0].metadata.fileHash) {
        this.fileHashes.set(file, docs[0].metadata.fileHash);
      }
    }
  }

  /**
   * Save hash map to disk.
   */
  private async saveHashMap(dirPath: string): Promise<void> {
    const storageDir = path.join(path.resolve(dirPath), '.joker_vectorstore');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const data = Object.fromEntries(this.fileHashes);
    fs.writeFileSync(
      path.join(storageDir, 'hashes.json'),
      JSON.stringify(data),
      'utf-8',
    );
  }

  /**
   * Save TF-IDF vocabulary to disk.
   */
  private saveTFIDF(dirPath: string): void {
    const storageDir = path.join(path.resolve(dirPath), '.joker_vectorstore');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const tfidf = this.embeddingProvider.getTFIDF();
    fs.writeFileSync(
      path.join(storageDir, 'tfidf.json'),
      JSON.stringify(tfidf.serialize()),
      'utf-8',
    );
  }

  /**
   * Load TF-IDF vocabulary from disk.
   */
  loadTFIDF(dirPath: string): boolean {
    const vocabPath = path.join(path.resolve(dirPath), '.joker_vectorstore', 'tfidf.json');
    if (!fs.existsSync(vocabPath)) return false;

    try {
      const raw = fs.readFileSync(vocabPath, 'utf-8');
      const data = JSON.parse(raw);
      const tfidf = TFIDFEmbedder.deserialize(data);
      this.embeddingProvider.setTFIDF(tfidf);
      return true;
    } catch {
      return false;
    }
  }
}
