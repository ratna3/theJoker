/**
 * The Joker - Agentic Terminal
 * Filesystem Module Exports
 */

export * from './watcher';
export * from './operations';
export * from './multi-file';

// Re-export defaults
export { fileWatcher } from './watcher';
export { fileOps } from './operations';
export { multiFileOps, getMultiFileOperator, createMultiFileOperator } from './multi-file';
