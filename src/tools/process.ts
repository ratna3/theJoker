/**
 * Process Tool - Data processing capabilities for The Joker
 * Supports data transformation, filtering, and analysis
 */

import { Tool, ToolCategory, ToolResult, toolRegistry } from './registry';
import { log } from '../utils/logger';

/**
 * Transform data using various operations
 */
async function transformData(params: Record<string, any>): Promise<ToolResult> {
  const {
    data,
    operations
  } = params;

  if (!data) {
    return { success: false, error: 'Data is required' };
  }

  if (!operations || !Array.isArray(operations)) {
    return { success: false, error: 'Operations array is required' };
  }

  try {
    log.info(`Transforming data with ${operations.length} operations`);
    
    let result = data;

    for (const op of operations) {
      switch (op.type) {
        case 'filter':
          if (Array.isArray(result)) {
            result = result.filter((item: any) => {
              if (op.condition === 'contains') {
                return String(item[op.field] || item).includes(op.value);
              }
              if (op.condition === 'equals') {
                return (item[op.field] || item) === op.value;
              }
              if (op.condition === 'gt') {
                return Number(item[op.field] || item) > Number(op.value);
              }
              if (op.condition === 'lt') {
                return Number(item[op.field] || item) < Number(op.value);
              }
              if (op.condition === 'exists') {
                return op.field in item;
              }
              return true;
            });
          }
          break;

        case 'map':
          if (Array.isArray(result)) {
            result = result.map((item: any) => {
              if (op.fields && Array.isArray(op.fields)) {
                const mapped: Record<string, any> = {};
                for (const field of op.fields) {
                  if (typeof field === 'string') {
                    mapped[field] = item[field];
                  } else if (typeof field === 'object') {
                    mapped[field.as || field.name] = item[field.name];
                  }
                }
                return mapped;
              }
              if (op.template) {
                return op.template.replace(/\{(\w+)\}/g, (_: any, key: string) => item[key] || '');
              }
              return item;
            });
          }
          break;

        case 'sort':
          if (Array.isArray(result)) {
            result = [...result].sort((a: any, b: any) => {
              const aVal = op.field ? a[op.field] : a;
              const bVal = op.field ? b[op.field] : b;
              const order = op.order === 'desc' ? -1 : 1;
              
              if (typeof aVal === 'string') {
                return order * aVal.localeCompare(bVal);
              }
              return order * (aVal - bVal);
            });
          }
          break;

        case 'limit':
          if (Array.isArray(result)) {
            const start = op.offset || 0;
            const end = start + (op.count || 10);
            result = result.slice(start, end);
          }
          break;

        case 'unique':
          if (Array.isArray(result)) {
            if (op.field) {
              const seen = new Set();
              result = result.filter((item: any) => {
                const val = item[op.field];
                if (seen.has(val)) return false;
                seen.add(val);
                return true;
              });
            } else {
              result = [...new Set(result)];
            }
          }
          break;

        case 'flatten':
          if (Array.isArray(result)) {
            result = result.flat(op.depth || 1);
          }
          break;

        case 'group':
          if (Array.isArray(result) && op.field) {
            const groups: Record<string, any[]> = {};
            for (const item of result) {
              const key = String(item[op.field] || 'undefined');
              if (!groups[key]) groups[key] = [];
              groups[key].push(item);
            }
            result = groups;
          }
          break;

        case 'aggregate':
          if (Array.isArray(result)) {
            const aggregated: Record<string, any> = {};
            
            if (op.count) {
              aggregated.count = result.length;
            }
            if (op.sum && op.field) {
              aggregated.sum = result.reduce((acc, item) => acc + Number(item[op.field] || 0), 0);
            }
            if (op.avg && op.field) {
              const sum = result.reduce((acc, item) => acc + Number(item[op.field] || 0), 0);
              aggregated.avg = result.length > 0 ? sum / result.length : 0;
            }
            if (op.min && op.field) {
              aggregated.min = Math.min(...result.map(item => Number(item[op.field] || 0)));
            }
            if (op.max && op.field) {
              aggregated.max = Math.max(...result.map(item => Number(item[op.field] || 0)));
            }
            
            result = aggregated;
          }
          break;

        case 'rename':
          if (typeof result === 'object' && !Array.isArray(result) && op.mapping) {
            const renamed: Record<string, any> = {};
            for (const [key, value] of Object.entries(result as Record<string, any>)) {
              const newKey = op.mapping[key] || key;
              renamed[newKey] = value;
            }
            result = renamed;
          } else if (Array.isArray(result) && op.mapping) {
            result = result.map((item: any) => {
              const renamed: Record<string, any> = {};
              for (const [key, value] of Object.entries(item)) {
                const newKey = op.mapping[key] || key;
                renamed[newKey] = value;
              }
              return renamed;
            });
          }
          break;

        default:
          log.warn(`Unknown operation type: ${op.type}`);
      }
    }

    return {
      success: true,
      data: {
        result,
        operationsApplied: operations.length
      }
    };

  } catch (error: any) {
    log.error(`Transform failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract and clean text from raw content
 */
async function cleanText(params: Record<string, any>): Promise<ToolResult> {
  const {
    text,
    options = {}
  } = params;

  if (!text) {
    return { success: false, error: 'Text is required' };
  }

  try {
    log.info('Cleaning text content');

    let result = text;

    // Remove HTML tags
    if (options.removeHtml !== false) {
      result = result.replace(/<[^>]*>/g, '');
    }

    // Decode HTML entities
    if (options.decodeEntities !== false) {
      result = result
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    // Normalize whitespace
    if (options.normalizeWhitespace !== false) {
      result = result
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();
    }

    // Remove URLs
    if (options.removeUrls) {
      result = result.replace(/https?:\/\/[^\s]+/g, '');
    }

    // Remove emails
    if (options.removeEmails) {
      result = result.replace(/[\w.-]+@[\w.-]+\.\w+/g, '');
    }

    // Remove special characters
    if (options.removeSpecialChars) {
      result = result.replace(/[^\w\s.,!?-]/g, '');
    }

    // Convert to lowercase
    if (options.lowercase) {
      result = result.toLowerCase();
    }

    // Truncate
    if (options.maxLength && result.length > options.maxLength) {
      result = result.substring(0, options.maxLength) + '...';
    }

    return {
      success: true,
      data: {
        original: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        cleaned: result,
        originalLength: text.length,
        cleanedLength: result.length
      }
    };

  } catch (error: any) {
    log.error(`Clean text failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract structured data from text
 */
async function extractPatterns(params: Record<string, any>): Promise<ToolResult> {
  const {
    text,
    patterns
  } = params;

  if (!text) {
    return { success: false, error: 'Text is required' };
  }

  if (!patterns || typeof patterns !== 'object') {
    return { success: false, error: 'Patterns object is required' };
  }

  try {
    log.info('Extracting patterns from text');

    const results: Record<string, string[]> = {};

    // Built-in patterns
    const builtInPatterns: Record<string, RegExp> = {
      email: /[\w.-]+@[\w.-]+\.\w+/g,
      url: /https?:\/\/[^\s<>"{}|\\^`[\]]+/g,
      phone: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
      ip: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
      date: /\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/g,
      price: /\$[\d,]+(?:\.\d{2})?/g,
      hashtag: /#\w+/g,
      mention: /@\w+/g
    };

    for (const [name, pattern] of Object.entries(patterns)) {
      try {
        let regex: RegExp;
        
        if (pattern === true && builtInPatterns[name]) {
          regex = builtInPatterns[name];
        } else if (typeof pattern === 'string') {
          regex = new RegExp(pattern, 'g');
        } else {
          continue;
        }

        const matches = text.match(regex) || [];
        results[name] = [...new Set(matches)] as string[]; // Unique matches
      } catch (e) {
        log.warn(`Invalid pattern for ${name}`);
      }
    }

    return {
      success: true,
      data: {
        patterns: results,
        matchCounts: Object.fromEntries(
          Object.entries(results).map(([k, v]) => [k, v.length])
        )
      }
    };

  } catch (error: any) {
    log.error(`Extract patterns failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Convert data between formats
 */
async function convertFormat(params: Record<string, any>): Promise<ToolResult> {
  const {
    data,
    from,
    to
  } = params;

  if (!data) {
    return { success: false, error: 'Data is required' };
  }

  try {
    log.info(`Converting from ${from || 'auto'} to ${to}`);

    let parsed: any = data;

    // Parse input format
    if (from === 'json' && typeof data === 'string') {
      parsed = JSON.parse(data);
    } else if (from === 'csv' && typeof data === 'string') {
      const lines = data.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      parsed = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = values[i]?.trim() || '';
        });
        return obj;
      });
    }

    // Convert to output format
    let output: any;

    switch (to) {
      case 'json':
        output = JSON.stringify(parsed, null, 2);
        break;

      case 'csv':
        if (Array.isArray(parsed) && parsed.length > 0) {
          const headers = Object.keys(parsed[0]);
          const rows = [
            headers.join(','),
            ...parsed.map((row: any) => 
              headers.map(h => {
                const val = String(row[h] || '');
                return val.includes(',') ? `"${val}"` : val;
              }).join(',')
            )
          ];
          output = rows.join('\n');
        } else {
          output = '';
        }
        break;

      case 'markdown':
        if (Array.isArray(parsed) && parsed.length > 0) {
          const headers = Object.keys(parsed[0]);
          const rows = [
            '| ' + headers.join(' | ') + ' |',
            '| ' + headers.map(() => '---').join(' | ') + ' |',
            ...parsed.map((row: any) => 
              '| ' + headers.map(h => String(row[h] || '')).join(' | ') + ' |'
            )
          ];
          output = rows.join('\n');
        } else if (typeof parsed === 'object') {
          output = Object.entries(parsed)
            .map(([k, v]) => `- **${k}**: ${v}`)
            .join('\n');
        } else {
          output = String(parsed);
        }
        break;

      case 'xml':
        const toXml = (obj: any, root = 'root'): string => {
          if (Array.isArray(obj)) {
            return `<${root}>${obj.map(item => toXml(item, 'item')).join('')}</${root}>`;
          }
          if (typeof obj === 'object' && obj !== null) {
            const children = Object.entries(obj)
              .map(([k, v]) => toXml(v, k))
              .join('');
            return `<${root}>${children}</${root}>`;
          }
          return `<${root}>${String(obj)}</${root}>`;
        };
        output = '<?xml version="1.0" encoding="UTF-8"?>\n' + toXml(parsed);
        break;

      case 'yaml':
        const toYaml = (obj: any, indent = 0): string => {
          const spaces = '  '.repeat(indent);
          if (Array.isArray(obj)) {
            return obj.map(item => `${spaces}- ${toYaml(item, indent + 1).trim()}`).join('\n');
          }
          if (typeof obj === 'object' && obj !== null) {
            return Object.entries(obj)
              .map(([k, v]) => {
                if (typeof v === 'object') {
                  return `${spaces}${k}:\n${toYaml(v, indent + 1)}`;
                }
                return `${spaces}${k}: ${v}`;
              })
              .join('\n');
          }
          return String(obj);
        };
        output = toYaml(parsed);
        break;

      default:
        output = parsed;
    }

    return {
      success: true,
      data: {
        output,
        fromFormat: from || 'auto',
        toFormat: to
      }
    };

  } catch (error: any) {
    log.error(`Convert format failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Summarize data
 */
async function summarizeData(params: Record<string, any>): Promise<ToolResult> {
  const { data } = params;

  if (!data) {
    return { success: false, error: 'Data is required' };
  }

  try {
    log.info('Summarizing data');

    const summary: Record<string, any> = {};

    if (Array.isArray(data)) {
      summary.type = 'array';
      summary.length = data.length;
      summary.isEmpty = data.length === 0;

      if (data.length > 0) {
        const sample = data[0];
        if (typeof sample === 'object' && sample !== null) {
          summary.fields = Object.keys(sample);
          summary.fieldCount = summary.fields.length;
          
          // Sample data
          summary.sample = data.slice(0, 3);
        } else {
          summary.itemType = typeof sample;
          summary.sample = data.slice(0, 5);
        }

        // Check for common field types
        if (typeof data[0] === 'object') {
          summary.fieldTypes = {};
          for (const field of Object.keys(data[0])) {
            const types = new Set(data.map(item => typeof item[field]));
            summary.fieldTypes[field] = [...types].join(' | ');
          }
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      summary.type = 'object';
      summary.keys = Object.keys(data);
      summary.keyCount = summary.keys.length;
      summary.preview = Object.fromEntries(
        Object.entries(data).slice(0, 5).map(([k, v]) => [
          k,
          typeof v === 'string' && v.length > 50 ? v.substring(0, 50) + '...' : v
        ])
      );
    } else if (typeof data === 'string') {
      summary.type = 'string';
      summary.length = data.length;
      summary.wordCount = data.split(/\s+/).filter(Boolean).length;
      summary.lineCount = data.split('\n').length;
      summary.preview = data.substring(0, 200) + (data.length > 200 ? '...' : '');
    } else {
      summary.type = typeof data;
      summary.value = data;
    }

    return {
      success: true,
      data: summary
    };

  } catch (error: any) {
    log.error(`Summarize failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// Define tools
export const transformDataTool: Tool = {
  name: 'transform_data',
  description: 'Transform data using operations like filter, map, sort, group, and aggregate.',
  category: ToolCategory.PROCESS,
  parameters: [
    {
      name: 'data',
      type: 'array',
      description: 'The data to transform (array or object)',
      required: true
    },
    {
      name: 'operations',
      type: 'array',
      description: 'Array of operations to apply (filter, map, sort, limit, unique, flatten, group, aggregate, rename)',
      required: true
    }
  ],
  execute: transformData
};

export const cleanTextTool: Tool = {
  name: 'clean_text',
  description: 'Clean and normalize text content.',
  category: ToolCategory.PROCESS,
  parameters: [
    {
      name: 'text',
      type: 'string',
      description: 'The text to clean',
      required: true
    },
    {
      name: 'options',
      type: 'object',
      description: 'Cleaning options (removeHtml, decodeEntities, normalizeWhitespace, removeUrls, removeEmails, removeSpecialChars, lowercase, maxLength)',
      required: false
    }
  ],
  execute: cleanText
};

export const extractPatternsTool: Tool = {
  name: 'extract_patterns',
  description: 'Extract structured data from text using patterns (email, url, phone, etc.).',
  category: ToolCategory.PROCESS,
  parameters: [
    {
      name: 'text',
      type: 'string',
      description: 'The text to extract from',
      required: true
    },
    {
      name: 'patterns',
      type: 'object',
      description: 'Patterns to extract (use true for built-in: email, url, phone, ip, date, price, hashtag, mention)',
      required: true
    }
  ],
  execute: extractPatterns
};

export const convertFormatTool: Tool = {
  name: 'convert_format',
  description: 'Convert data between formats (json, csv, markdown, xml, yaml).',
  category: ToolCategory.PROCESS,
  parameters: [
    {
      name: 'data',
      type: 'string',
      description: 'The data to convert',
      required: true
    },
    {
      name: 'from',
      type: 'string',
      description: 'Source format',
      required: false,
      enum: ['json', 'csv', 'auto']
    },
    {
      name: 'to',
      type: 'string',
      description: 'Target format',
      required: true,
      enum: ['json', 'csv', 'markdown', 'xml', 'yaml']
    }
  ],
  execute: convertFormat
};

export const summarizeDataTool: Tool = {
  name: 'summarize_data',
  description: 'Get a summary of data structure and content.',
  category: ToolCategory.PROCESS,
  parameters: [
    {
      name: 'data',
      type: 'object',
      description: 'The data to summarize (array, object, or string)',
      required: true
    }
  ],
  execute: summarizeData
};

/**
 * Register all process tools
 */
export function registerProcessTools(): void {
  toolRegistry.register(transformDataTool);
  toolRegistry.register(cleanTextTool);
  toolRegistry.register(extractPatternsTool);
  toolRegistry.register(convertFormatTool);
  toolRegistry.register(summarizeDataTool);
  log.info('Process tools registered');
}

export { transformData, cleanText, extractPatterns, convertFormat, summarizeData };
