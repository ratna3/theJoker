/**
 * Tools Module - Central export for all tool implementations
 * Phase 5: Tool System & Execution
 */

// Core registry
export {
  Tool,
  ToolParameter,
  ToolCategory,
  ToolRegistry,
  toolRegistry,
} from './registry';

// Search tools
export {
  registerSearchTools,
  performSearch,
  webSearchTool,
  quickSearchTool,
  imageSearchTool,
} from './search';

// Scrape tools
export {
  registerScrapeTools,
  scrapeTool,
  extractContent,
  screenshotTool,
  extractTableTool,
  parseHtmlTool,
  scrapePageTool,
  extractContentToolDef,
  screenshotToolDef,
  extractTableToolDef,
  parseHtmlToolDef,
} from './scrape';

// Process tools
export {
  registerProcessTools,
  transformData,
  cleanText,
  extractPatterns,
  convertFormat,
  summarizeData,
  transformDataTool,
  cleanTextTool,
  extractPatternsTool,
  convertFormatTool,
  summarizeDataTool,
} from './process';

// File tools
export {
  registerFileTools,
  readFileTool,
  writeFileTool,
  appendFileTool,
  deleteFileTool,
  listDirTool,
  copyFileTool,
  moveFileTool,
  fileExistsTool,
  createDirTool,
  readFileToolDef,
  writeFileToolDef,
  appendFileToolDef,
  deleteFileToolDef,
  listDirToolDef,
  copyFileToolDef,
  moveFileToolDef,
  fileExistsToolDef,
  createDirToolDef,
} from './file';

// Code tools
export {
  registerCodeTools,
  generateCode,
  modifyCode,
  scaffoldProject,
  analyzeCode,
  generateCodeTool,
  modifyCodeTool,
  scaffoldProjectTool,
  analyzeCodeTool,
} from './code';

import { logger } from '../utils/logger';
import { registerSearchTools } from './search';
import { registerScrapeTools } from './scrape';
import { registerProcessTools } from './process';
import { registerFileTools } from './file';
import { registerCodeTools } from './code';
import { Tool, toolRegistry } from './registry';

/**
 * Initialize all tools - registers all tool categories
 */
export function initializeAllTools(): void {
  logger.info('Initializing all tools...');
  
  registerSearchTools();
  registerScrapeTools();
  registerProcessTools();
  registerFileTools();
  registerCodeTools();
  
  const tools = toolRegistry.getAll();
  logger.info(`✅ Initialized ${tools.length} tools across all categories`);
  
  // Log tool summary by category
  const categories = new Map<string, number>();
  for (const tool of tools) {
    const count = categories.get(tool.category) || 0;
    categories.set(tool.category, count + 1);
  }
  
  for (const [category, count] of categories) {
    logger.info(`   📦 ${category}: ${count} tools`);
  }
}

/**
 * Execute a tool by name
 */
export async function executeTool(name: string, params: Record<string, any>): Promise<any> {
  return toolRegistry.execute(name, params);
}

/**
 * Get available tools
 */
export function getAvailableTools(): Array<{ name: string; description: string; category: string }> {
  return toolRegistry.getAll().map((tool: Tool) => ({
    name: tool.name,
    description: tool.description,
    category: tool.category,
  }));
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string): Array<{ name: string; description: string }> {
  return toolRegistry.getAll()
    .filter((tool: Tool) => tool.category === category)
    .map((tool: Tool) => ({
      name: tool.name,
      description: tool.description,
    }));
}

/**
 * Check if a tool exists
 */
export function toolExists(name: string): boolean {
  return toolRegistry.get(name) !== undefined;
}
