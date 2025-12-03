/**
 * The Joker - Agentic Terminal
 * Advanced Code Parser
 * 
 * AST-based code parsing for multiple languages with
 * symbol extraction, dependency analysis, and code metrics.
 */

import { logger } from '../utils/logger';
import type {
  FunctionInfo,
  ClassInfo,
  VariableInfo,
  ImportInfo,
  ExportInfo,
  ParameterInfo,
  MethodInfo,
  PropertyInfo
} from './indexer';

// ============================================
// Parser Types
// ============================================

/**
 * Supported languages for parsing
 */
export type SupportedLanguage = 
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'css'
  | 'html'
  | 'unknown';

/**
 * Code complexity metrics
 */
export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  linesOfComments: number;
  blankLines: number;
  maintainabilityIndex: number;
}

/**
 * Code smell detection
 */
export interface CodeSmell {
  type: 'long-function' | 'long-parameter-list' | 'deeply-nested' | 'god-class' | 'dead-code' | 'duplicate-code' | 'magic-number';
  severity: 'info' | 'warning' | 'error';
  message: string;
  line: number;
  column?: number;
  suggestion?: string;
}

/**
 * Comment information
 */
export interface CommentInfo {
  type: 'single' | 'multi' | 'jsdoc' | 'todo' | 'fixme';
  content: string;
  line: number;
  endLine?: number;
}

/**
 * Type definition information
 */
export interface TypeDefinition {
  name: string;
  kind: 'interface' | 'type' | 'enum';
  line: number;
  properties?: TypeProperty[];
  members?: string[];
  isExported: boolean;
  jsdoc?: string;
}

/**
 * Type property
 */
export interface TypeProperty {
  name: string;
  type: string;
  optional: boolean;
  readonly: boolean;
}

/**
 * Full parsed code structure
 */
export interface ParsedCode {
  language: SupportedLanguage;
  imports: ImportInfo[];
  exports: ExportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  variables: VariableInfo[];
  types: TypeDefinition[];
  comments: CommentInfo[];
  metrics: ComplexityMetrics;
  smells: CodeSmell[];
}

/**
 * Parser options
 */
export interface ParserOptions {
  /** Calculate complexity metrics */
  calculateMetrics?: boolean;
  /** Detect code smells */
  detectSmells?: boolean;
  /** Extract comments */
  extractComments?: boolean;
  /** Parse type definitions */
  parseTypes?: boolean;
  /** Maximum function length before warning */
  maxFunctionLength?: number;
  /** Maximum parameter count before warning */
  maxParameters?: number;
  /** Maximum nesting depth before warning */
  maxNestingDepth?: number;
}

// ============================================
// Code Parser Class
// ============================================

/**
 * Advanced code parser with multi-language support
 */
export class CodeParser {
  private options: Required<ParserOptions>;

  constructor(options: ParserOptions = {}) {
    this.options = {
      calculateMetrics: options.calculateMetrics ?? true,
      detectSmells: options.detectSmells ?? true,
      extractComments: options.extractComments ?? true,
      parseTypes: options.parseTypes ?? true,
      maxFunctionLength: options.maxFunctionLength ?? 50,
      maxParameters: options.maxParameters ?? 5,
      maxNestingDepth: options.maxNestingDepth ?? 4
    };
  }

  /**
   * Parse code content
   */
  parse(content: string, language: SupportedLanguage): ParsedCode {
    logger.debug('Parsing code', { language, lines: content.split('\n').length });

    const result: ParsedCode = {
      language,
      imports: [],
      exports: [],
      functions: [],
      classes: [],
      variables: [],
      types: [],
      comments: [],
      metrics: this.getEmptyMetrics(),
      smells: []
    };

    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          this.parseTypeScript(content, result);
          break;
        case 'python':
          this.parsePython(content, result);
          break;
        case 'rust':
          this.parseRust(content, result);
          break;
        case 'go':
          this.parseGo(content, result);
          break;
        case 'java':
          this.parseJava(content, result);
          break;
        case 'json':
          this.parseJSON(content, result);
          break;
        case 'yaml':
          this.parseYAML(content, result);
          break;
        case 'css':
          this.parseCSS(content, result);
          break;
        case 'html':
          this.parseHTML(content, result);
          break;
        default:
          // Basic parsing for unknown languages
          this.parseGeneric(content, result);
      }

      // Calculate metrics if enabled
      if (this.options.calculateMetrics) {
        result.metrics = this.calculateMetrics(content, result);
      }

      // Detect code smells if enabled
      if (this.options.detectSmells) {
        result.smells = this.detectCodeSmells(content, result);
      }

    } catch (error) {
      logger.warn('Failed to parse code', { language, error });
    }

    return result;
  }

  /**
   * Detect language from file extension
   */
  detectLanguage(extension: string): SupportedLanguage {
    const languageMap: Record<string, SupportedLanguage> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.py': 'python',
      '.rs': 'rust',
      '.go': 'go',
      '.java': 'java',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.css': 'css',
      '.scss': 'css',
      '.less': 'css',
      '.html': 'html',
      '.htm': 'html',
      '.md': 'markdown',
      '.mdx': 'markdown'
    };
    return languageMap[extension.toLowerCase()] || 'unknown';
  }

  // ============================================
  // TypeScript/JavaScript Parser
  // ============================================

  private parseTypeScript(content: string, result: ParsedCode): void {
    const lines = content.split('\n');

    // Parse imports
    result.imports = this.parseTypeScriptImports(content, lines);

    // Parse exports
    result.exports = this.parseTypeScriptExports(content, lines);

    // Parse functions
    result.functions = this.parseTypeScriptFunctions(content, lines);

    // Parse classes
    result.classes = this.parseTypeScriptClasses(content, lines);

    // Parse variables
    result.variables = this.parseTypeScriptVariables(lines);

    // Parse types if enabled
    if (this.options.parseTypes) {
      result.types = this.parseTypeScriptTypes(content, lines);
    }

    // Parse comments if enabled
    if (this.options.extractComments) {
      result.comments = this.parseTypeScriptComments(content, lines);
    }
  }

  private parseTypeScriptImports(content: string, lines: string[]): ImportInfo[] {
    const imports: ImportInfo[] = [];

    // ES6 imports
    const importRegex = /^import\s+(?:(\*\s+as\s+(\w+))|({[^}]+})|(\w+))(?:\s*,\s*({[^}]+}))?\s+from\s+['"]([^'"]+)['"]/;
    const sideEffectImport = /^import\s+['"]([^'"]+)['"]/;
    const dynamicImportRegex = /(?:await\s+)?import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Side effect import
      const sideEffectMatch = trimmed.match(sideEffectImport);
      if (sideEffectMatch && !trimmed.includes(' from ')) {
        imports.push({
          source: sideEffectMatch[1],
          specifiers: [],
          line: index + 1,
          isDefault: false,
          isNamespace: false,
          isDynamic: false
        });
        return;
      }

      // Regular import
      const importMatch = trimmed.match(importRegex);
      if (importMatch) {
        const specifiers: { name: string; alias?: string; isDefault: boolean }[] = [];
        const source = importMatch[6];
        
        // Namespace import: import * as name
        if (importMatch[1]) {
          specifiers.push({ name: importMatch[2], isDefault: false });
          imports.push({
            source,
            specifiers,
            line: index + 1,
            isDefault: false,
            isNamespace: true,
            isDynamic: false
          });
        } 
        // Default import
        else if (importMatch[4]) {
          specifiers.push({ name: importMatch[4], isDefault: true });
          
          // Also named imports
          if (importMatch[5]) {
            this.extractNamedImports(importMatch[5], specifiers);
          }
          
          imports.push({
            source,
            specifiers,
            line: index + 1,
            isDefault: true,
            isNamespace: false,
            isDynamic: false
          });
        }
        // Named imports only
        else if (importMatch[3]) {
          this.extractNamedImports(importMatch[3], specifiers);
          imports.push({
            source,
            specifiers,
            line: index + 1,
            isDefault: false,
            isNamespace: false,
            isDynamic: false
          });
        }
      }
    });

    // Dynamic imports
    let dynamicMatch;
    while ((dynamicMatch = dynamicImportRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, dynamicMatch.index).split('\n').length;
      imports.push({
        source: dynamicMatch[1],
        specifiers: [],
        line: lineNumber,
        isDefault: false,
        isNamespace: false,
        isDynamic: true
      });
    }

    return imports;
  }

  private extractNamedImports(
    namedString: string,
    specifiers: { name: string; alias?: string; isDefault: boolean }[]
  ): void {
    const cleaned = namedString.replace(/[{}]/g, '');
    const parts = cleaned.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const aliasParts = trimmed.split(/\s+as\s+/);
      specifiers.push({
        name: aliasParts[0].trim(),
        alias: aliasParts[1]?.trim(),
        isDefault: false
      });
    }
  }

  private parseTypeScriptExports(content: string, lines: string[]): ExportInfo[] {
    const exports: ExportInfo[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Export default
      if (trimmed.startsWith('export default')) {
        const nameMatch = trimmed.match(/export\s+default\s+(?:class|function|const|let|var)?\s*(\w+)?/);
        exports.push({
          name: nameMatch?.[1] || 'default',
          line: index + 1,
          isDefault: true,
          isReExport: false
        });
      }
      // Named exports
      else if (trimmed.match(/^export\s+(?:const|let|var|function|async\s+function|class|interface|type|enum)/)) {
        const nameMatch = trimmed.match(/^export\s+(?:async\s+)?(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/);
        if (nameMatch) {
          exports.push({
            name: nameMatch[1],
            line: index + 1,
            isDefault: false,
            isReExport: false
          });
        }
      }
      // Re-exports
      else if (trimmed.match(/^export\s+(?:{[^}]*}|\*)\s+from/)) {
        const reExportMatch = trimmed.match(/^export\s+(?:{([^}]+)}|\*(?:\s+as\s+(\w+))?)\s+from\s+['"]([^'"]+)['"]/);
        if (reExportMatch) {
          if (reExportMatch[1]) {
            // Named re-exports
            const names = reExportMatch[1].split(',');
            for (const name of names) {
              const cleanName = name.trim().split(/\s+as\s+/)[0];
              if (cleanName) {
                exports.push({
                  name: cleanName,
                  line: index + 1,
                  isDefault: false,
                  isReExport: true,
                  source: reExportMatch[3]
                });
              }
            }
          } else {
            // Namespace re-export
            exports.push({
              name: reExportMatch[2] || '*',
              line: index + 1,
              isDefault: false,
              isReExport: true,
              source: reExportMatch[3]
            });
          }
        }
      }
    });

    return exports;
  }

  private parseTypeScriptFunctions(content: string, lines: string[]): FunctionInfo[] {
    const functions: FunctionInfo[] = [];

    // Function declarations
    const funcDeclRegex = /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/;
    
    // Arrow functions
    const arrowFuncRegex = /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(?([^)=]*)\)?\s*(?::\s*([^=]+))?\s*=>/;
    
    // Method-like arrow functions
    const methodArrowRegex = /(\w+)\s*:\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Function declaration
      const funcMatch = trimmed.match(funcDeclRegex);
      if (funcMatch) {
        const endLine = this.findClosingBrace(lines, index);
        functions.push({
          name: funcMatch[1],
          line: index + 1,
          column: line.indexOf(funcMatch[1]),
          endLine,
          parameters: this.parseParameters(funcMatch[2]),
          returnType: funcMatch[3]?.trim(),
          isAsync: trimmed.includes('async '),
          isExported: trimmed.startsWith('export'),
          isArrow: false
        });
        return;
      }

      // Arrow function
      const arrowMatch = trimmed.match(arrowFuncRegex);
      if (arrowMatch) {
        const endLine = this.findClosingBrace(lines, index) || 
                       this.findExpressionEnd(lines, index);
        functions.push({
          name: arrowMatch[1],
          line: index + 1,
          column: line.indexOf(arrowMatch[1]),
          endLine,
          parameters: this.parseParameters(arrowMatch[2]),
          returnType: arrowMatch[3]?.trim(),
          isAsync: trimmed.includes('async '),
          isExported: trimmed.startsWith('export'),
          isArrow: true
        });
      }
    });

    return functions;
  }

  private parseTypeScriptClasses(content: string, lines: string[]): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const classRegex = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s*<[^>]*>)?(?:\s+extends\s+(\w+)(?:<[^>]*>)?)?(?:\s+implements\s+([^{]+))?/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const classMatch = trimmed.match(classRegex);
      
      if (classMatch) {
        const endLine = this.findClosingBrace(lines, index);
        const classBody = lines.slice(index, endLine ? endLine : undefined).join('\n');
        
        classes.push({
          name: classMatch[1],
          line: index + 1,
          column: line.indexOf(classMatch[1]),
          endLine,
          methods: this.parseClassMethods(classBody, index),
          properties: this.parseClassProperties(classBody, index),
          extends: classMatch[2],
          implements: classMatch[3]?.split(',').map(s => s.trim()),
          isExported: trimmed.startsWith('export'),
          isAbstract: trimmed.includes('abstract ')
        });
      }
    });

    return classes;
  }

  private parseClassMethods(classBody: string, startLine: number): MethodInfo[] {
    const methods: MethodInfo[] = [];
    const lines = classBody.split('\n');

    // Method patterns
    const methodRegex = /^\s*(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(async)\s+)?(\w+)\s*(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?/;

    lines.forEach((line, index) => {
      if (index === 0) return; // Skip class declaration line

      const methodMatch = line.match(methodRegex);
      if (methodMatch && !line.includes('constructor')) {
        methods.push({
          name: methodMatch[4],
          line: startLine + index + 1,
          parameters: this.parseParameters(methodMatch[5]),
          returnType: methodMatch[6]?.trim(),
          isAsync: !!methodMatch[3],
          isStatic: !!methodMatch[2],
          isPrivate: methodMatch[1] === 'private' || methodMatch[4].startsWith('#'),
          isProtected: methodMatch[1] === 'protected',
          visibility: (methodMatch[1] as 'public' | 'private' | 'protected') || 'public'
        });
      }
    });

    return methods;
  }

  private parseClassProperties(classBody: string, startLine: number): PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    const lines = classBody.split('\n');

    // Property patterns
    const propRegex = /^\s*(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(readonly)\s+)?(\w+)(?:\?)?(?:\s*:\s*([^=;]+))?(?:\s*=\s*([^;]+))?;?$/;

    lines.forEach((line, index) => {
      if (index === 0) return; // Skip class declaration line
      const trimmed = line.trim();
      
      // Skip methods and constructors
      if (trimmed.includes('(') || trimmed.startsWith('constructor')) {
        return;
      }

      const propMatch = trimmed.match(propRegex);
      if (propMatch && propMatch[4]) {
        properties.push({
          name: propMatch[4],
          line: startLine + index + 1,
          type: propMatch[5]?.trim(),
          isStatic: !!propMatch[2],
          isReadonly: !!propMatch[3],
          visibility: (propMatch[1] as 'public' | 'private' | 'protected') || 'public',
          defaultValue: propMatch[6]?.trim()
        });
      }
    });

    return properties;
  }

  private parseTypeScriptVariables(lines: string[]): VariableInfo[] {
    const variables: VariableInfo[] = [];
    const varRegex = /^(?:export\s+)?(const|let|var)\s+(\w+)(?:\s*:\s*([^=]+))?\s*=/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Skip function/arrow function declarations
      if (trimmed.includes('=>') || trimmed.includes('function')) {
        return;
      }

      const varMatch = trimmed.match(varRegex);
      if (varMatch) {
        variables.push({
          name: varMatch[2],
          line: index + 1,
          column: line.indexOf(varMatch[2]),
          type: varMatch[3]?.trim(),
          kind: varMatch[1] as 'const' | 'let' | 'var',
          isExported: trimmed.startsWith('export')
        });
      }
    });

    return variables;
  }

  private parseTypeScriptTypes(content: string, lines: string[]): TypeDefinition[] {
    const types: TypeDefinition[] = [];

    // Interface
    const interfaceRegex = /^(?:export\s+)?interface\s+(\w+)(?:\s*<[^>]*>)?(?:\s+extends\s+[^{]+)?/;
    // Type alias
    const typeRegex = /^(?:export\s+)?type\s+(\w+)(?:\s*<[^>]*>)?\s*=/;
    // Enum
    const enumRegex = /^(?:export\s+)?(?:const\s+)?enum\s+(\w+)/;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      const interfaceMatch = trimmed.match(interfaceRegex);
      if (interfaceMatch) {
        const endLine = this.findClosingBrace(lines, index);
        const body = lines.slice(index + 1, endLine).join('\n');
        
        types.push({
          name: interfaceMatch[1],
          kind: 'interface',
          line: index + 1,
          properties: this.parseInterfaceProperties(body),
          isExported: trimmed.startsWith('export')
        });
        return;
      }

      const typeMatch = trimmed.match(typeRegex);
      if (typeMatch) {
        types.push({
          name: typeMatch[1],
          kind: 'type',
          line: index + 1,
          isExported: trimmed.startsWith('export')
        });
        return;
      }

      const enumMatch = trimmed.match(enumRegex);
      if (enumMatch) {
        const endLine = this.findClosingBrace(lines, index);
        const body = lines.slice(index + 1, endLine).join('\n');
        
        types.push({
          name: enumMatch[1],
          kind: 'enum',
          line: index + 1,
          members: this.parseEnumMembers(body),
          isExported: trimmed.startsWith('export')
        });
      }
    });

    return types;
  }

  private parseInterfaceProperties(body: string): TypeProperty[] {
    const properties: TypeProperty[] = [];
    const lines = body.split('\n');
    
    const propRegex = /^\s*(?:(readonly)\s+)?(\w+)(\?)?:\s*(.+?);?\s*$/;

    for (const line of lines) {
      const match = line.match(propRegex);
      if (match) {
        properties.push({
          name: match[2],
          type: match[4].replace(/;$/, '').trim(),
          optional: !!match[3],
          readonly: !!match[1]
        });
      }
    }

    return properties;
  }

  private parseEnumMembers(body: string): string[] {
    const members: string[] = [];
    const lines = body.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\w+)(?:\s*=\s*.+?)?,?\s*$/);
      if (match) {
        members.push(match[1]);
      }
    }

    return members;
  }

  private parseTypeScriptComments(content: string, lines: string[]): CommentInfo[] {
    const comments: CommentInfo[] = [];

    // Single-line comments
    const singleLineRegex = /\/\/(.+)$/;
    // Multi-line comments
    const multiLineStart = /\/\*(?!\*)/;
    const multiLineEnd = /\*\//;
    // JSDoc comments
    const jsdocStart = /\/\*\*/;

    let inMultiLine = false;
    let inJSDoc = false;
    let multiLineStart_line = 0;
    let multiLineContent: string[] = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Handle multi-line/JSDoc comments
      if (inMultiLine || inJSDoc) {
        multiLineContent.push(line);
        if (multiLineEnd.test(trimmed)) {
          comments.push({
            type: inJSDoc ? 'jsdoc' : 'multi',
            content: multiLineContent.join('\n'),
            line: multiLineStart_line + 1,
            endLine: index + 1
          });
          inMultiLine = false;
          inJSDoc = false;
          multiLineContent = [];
        }
        return;
      }

      // JSDoc start
      if (jsdocStart.test(trimmed)) {
        inJSDoc = true;
        multiLineStart_line = index;
        multiLineContent = [line];
        if (multiLineEnd.test(trimmed)) {
          comments.push({
            type: 'jsdoc',
            content: line,
            line: index + 1
          });
          inJSDoc = false;
          multiLineContent = [];
        }
        return;
      }

      // Multi-line start
      if (multiLineStart.test(trimmed)) {
        inMultiLine = true;
        multiLineStart_line = index;
        multiLineContent = [line];
        if (multiLineEnd.test(trimmed)) {
          comments.push({
            type: 'multi',
            content: line,
            line: index + 1
          });
          inMultiLine = false;
          multiLineContent = [];
        }
        return;
      }

      // Single-line comment
      const singleMatch = trimmed.match(singleLineRegex);
      if (singleMatch) {
        const content = singleMatch[1].trim();
        let type: 'single' | 'todo' | 'fixme' = 'single';
        
        if (/TODO/i.test(content)) type = 'todo';
        else if (/FIXME/i.test(content)) type = 'fixme';

        comments.push({
          type,
          content,
          line: index + 1
        });
      }
    });

    return comments;
  }

  // ============================================
  // Python Parser
  // ============================================

  private parsePython(content: string, result: ParsedCode): void {
    const lines = content.split('\n');

    // Imports
    const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/;
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) return;

      const importMatch = trimmed.match(importRegex);
      if (importMatch) {
        const source = importMatch[1] || importMatch[2].split(',')[0].trim();
        const specifiers = (importMatch[1] ? importMatch[2] : '').split(',')
          .map(s => s.trim())
          .filter(Boolean)
          .map(s => {
            const parts = s.split(/\s+as\s+/);
            return { name: parts[0], alias: parts[1], isDefault: false };
          });

        result.imports.push({
          source,
          specifiers,
          line: index + 1,
          isDefault: !importMatch[1],
          isNamespace: specifiers.length === 0,
          isDynamic: false
        });
      }
    });

    // Functions
    const funcRegex = /^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*(.+))?:/;
    
    lines.forEach((line, index) => {
      const funcMatch = line.match(funcRegex);
      if (funcMatch) {
        result.functions.push({
          name: funcMatch[1],
          line: index + 1,
          column: line.indexOf(funcMatch[1]),
          parameters: this.parsePythonParams(funcMatch[2]),
          returnType: funcMatch[3]?.trim(),
          isAsync: line.includes('async '),
          isExported: !funcMatch[1].startsWith('_'),
          isArrow: false
        });
      }
    });

    // Classes
    const classRegex = /^class\s+(\w+)(?:\(([^)]*)\))?:/;
    
    lines.forEach((line, index) => {
      const classMatch = line.match(classRegex);
      if (classMatch) {
        result.classes.push({
          name: classMatch[1],
          line: index + 1,
          column: line.indexOf(classMatch[1]),
          methods: [],
          properties: [],
          extends: classMatch[2]?.split(',')[0]?.trim(),
          isExported: !classMatch[1].startsWith('_'),
          isAbstract: false
        });
      }
    });

    // Comments
    if (this.options.extractComments) {
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
          const content = trimmed.substring(1).trim();
          let type: 'single' | 'todo' | 'fixme' = 'single';
          if (/TODO/i.test(content)) type = 'todo';
          else if (/FIXME/i.test(content)) type = 'fixme';

          result.comments.push({
            type,
            content,
            line: index + 1
          });
        }
      });
    }
  }

  private parsePythonParams(paramString: string): ParameterInfo[] {
    if (!paramString.trim()) return [];

    const params: ParameterInfo[] = [];
    const parts = paramString.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed || trimmed === 'self' || trimmed === 'cls') continue;

      const hasDefault = trimmed.includes('=');
      const typeMatch = trimmed.match(/(\w+)\s*:\s*([^=]+)/);
      const nameMatch = trimmed.match(/^(\w+)/);

      if (nameMatch) {
        params.push({
          name: nameMatch[1],
          type: typeMatch?.[2]?.trim(),
          optional: hasDefault,
          defaultValue: hasDefault ? trimmed.split('=')[1]?.trim() : undefined
        });
      }
    }

    return params;
  }

  // ============================================
  // Rust Parser
  // ============================================

  private parseRust(content: string, result: ParsedCode): void {
    const lines = content.split('\n');

    // Use statements
    const useRegex = /^use\s+(.+);$/;
    
    lines.forEach((line, index) => {
      const useMatch = line.trim().match(useRegex);
      if (useMatch) {
        result.imports.push({
          source: useMatch[1],
          specifiers: [],
          line: index + 1,
          isDefault: false,
          isNamespace: false,
          isDynamic: false
        });
      }
    });

    // Functions
    const fnRegex = /^(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?fn\s+(\w+)(?:<[^>]*>)?\s*\(([^)]*)\)(?:\s*->\s*(.+?))?(?:\s*where)?/;
    
    lines.forEach((line, index) => {
      const fnMatch = line.match(fnRegex);
      if (fnMatch) {
        result.functions.push({
          name: fnMatch[1],
          line: index + 1,
          column: line.indexOf(fnMatch[1]),
          parameters: this.parseRustParams(fnMatch[2]),
          returnType: fnMatch[3]?.trim(),
          isAsync: line.includes('async '),
          isExported: line.includes('pub '),
          isArrow: false
        });
      }
    });

    // Structs and Enums
    const structRegex = /^(?:pub(?:\([^)]+\))?\s+)?struct\s+(\w+)/;
    const enumRegex = /^(?:pub(?:\([^)]+\))?\s+)?enum\s+(\w+)/;
    
    lines.forEach((line, index) => {
      const structMatch = line.match(structRegex);
      if (structMatch) {
        result.classes.push({
          name: structMatch[1],
          line: index + 1,
          column: line.indexOf(structMatch[1]),
          methods: [],
          properties: [],
          isExported: line.includes('pub '),
          isAbstract: false
        });
      }

      const enumMatch = line.match(enumRegex);
      if (enumMatch) {
        result.types.push({
          name: enumMatch[1],
          kind: 'enum',
          line: index + 1,
          isExported: line.includes('pub ')
        });
      }
    });
  }

  private parseRustParams(paramString: string): ParameterInfo[] {
    if (!paramString.trim()) return [];

    const params: ParameterInfo[] = [];
    // Split carefully to handle generics
    const parts = this.splitParams(paramString);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed || trimmed === 'self' || trimmed === '&self' || trimmed === '&mut self') continue;

      const match = trimmed.match(/(?:mut\s+)?(\w+)\s*:\s*(.+)/);
      if (match) {
        params.push({
          name: match[1],
          type: match[2].trim(),
          optional: match[2].includes('Option<')
        });
      }
    }

    return params;
  }

  // ============================================
  // Go Parser
  // ============================================

  private parseGo(content: string, result: ParsedCode): void {
    const lines = content.split('\n');

    // Imports
    let inImportBlock = false;
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      if (trimmed === 'import (') {
        inImportBlock = true;
        return;
      }
      if (inImportBlock && trimmed === ')') {
        inImportBlock = false;
        return;
      }

      if (inImportBlock || trimmed.startsWith('import ')) {
        const importMatch = trimmed.match(/(?:import\s+)?(?:(\w+)\s+)?["']([^"']+)["']/);
        if (importMatch) {
          result.imports.push({
            source: importMatch[2],
            specifiers: importMatch[1] ? [{ name: importMatch[1], isDefault: false }] : [],
            line: index + 1,
            isDefault: false,
            isNamespace: !importMatch[1],
            isDynamic: false
          });
        }
      }
    });

    // Functions
    const funcRegex = /^func\s+(?:\((\w+)\s+\*?(\w+)\)\s+)?(\w+)\s*\(([^)]*)\)(?:\s*\(?([^)]*)\)?)?/;
    
    lines.forEach((line, index) => {
      const funcMatch = line.match(funcRegex);
      if (funcMatch) {
        result.functions.push({
          name: funcMatch[3],
          line: index + 1,
          column: line.indexOf(funcMatch[3]),
          parameters: this.parseGoParams(funcMatch[4]),
          returnType: funcMatch[5]?.trim(),
          isAsync: false,
          isExported: funcMatch[3][0] === funcMatch[3][0].toUpperCase(),
          isArrow: false
        });
      }
    });

    // Types and Structs
    const typeRegex = /^type\s+(\w+)\s+(struct|interface)/;
    
    lines.forEach((line, index) => {
      const typeMatch = line.match(typeRegex);
      if (typeMatch) {
        if (typeMatch[2] === 'struct') {
          result.classes.push({
            name: typeMatch[1],
            line: index + 1,
            column: line.indexOf(typeMatch[1]),
            methods: [],
            properties: [],
            isExported: typeMatch[1][0] === typeMatch[1][0].toUpperCase(),
            isAbstract: false
          });
        } else {
          result.types.push({
            name: typeMatch[1],
            kind: 'interface',
            line: index + 1,
            isExported: typeMatch[1][0] === typeMatch[1][0].toUpperCase()
          });
        }
      }
    });
  }

  private parseGoParams(paramString: string): ParameterInfo[] {
    if (!paramString.trim()) return [];

    const params: ParameterInfo[] = [];
    const parts = paramString.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const match = trimmed.match(/(\w+(?:\s*,\s*\w+)*)\s+(.+)/);
      if (match) {
        const names = match[1].split(',').map(n => n.trim());
        for (const name of names) {
          params.push({
            name,
            type: match[2].trim(),
            optional: false
          });
        }
      }
    }

    return params;
  }

  // ============================================
  // Java Parser
  // ============================================

  private parseJava(content: string, result: ParsedCode): void {
    const lines = content.split('\n');

    // Imports
    lines.forEach((line, index) => {
      const importMatch = line.match(/^import\s+(?:static\s+)?([^;]+);/);
      if (importMatch) {
        result.imports.push({
          source: importMatch[1],
          specifiers: [],
          line: index + 1,
          isDefault: false,
          isNamespace: importMatch[1].endsWith('.*'),
          isDynamic: false
        });
      }
    });

    // Classes
    const classRegex = /^(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?/;
    
    lines.forEach((line, index) => {
      const classMatch = line.match(classRegex);
      if (classMatch) {
        result.classes.push({
          name: classMatch[1],
          line: index + 1,
          column: line.indexOf(classMatch[1]),
          methods: [],
          properties: [],
          extends: classMatch[2],
          implements: classMatch[3]?.split(',').map(s => s.trim()),
          isExported: line.includes('public '),
          isAbstract: line.includes('abstract ')
        });
      }
    });

    // Methods
    const methodRegex = /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)/;
    
    lines.forEach((line, index) => {
      const methodMatch = line.match(methodRegex);
      if (methodMatch && !line.includes(' class ') && !line.includes(' interface ')) {
        result.functions.push({
          name: methodMatch[2],
          line: index + 1,
          column: line.indexOf(methodMatch[2]),
          parameters: this.parseJavaParams(methodMatch[3]),
          returnType: methodMatch[1],
          isAsync: false,
          isExported: line.includes('public '),
          isArrow: false
        });
      }
    });
  }

  private parseJavaParams(paramString: string): ParameterInfo[] {
    if (!paramString.trim()) return [];

    const params: ParameterInfo[] = [];
    const parts = paramString.split(',');

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      const match = trimmed.match(/(?:final\s+)?(\S+)\s+(\w+)/);
      if (match) {
        params.push({
          name: match[2],
          type: match[1],
          optional: false
        });
      }
    }

    return params;
  }

  // ============================================
  // Other Parsers
  // ============================================

  private parseJSON(content: string, result: ParsedCode): void {
    // JSON doesn't have traditional symbols, but we can identify top-level keys
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null) {
        for (const key of Object.keys(parsed)) {
          result.variables.push({
            name: key,
            line: 1,
            column: 0,
            kind: 'const',
            isExported: true
          });
        }
      }
    } catch {
      // Invalid JSON
    }
  }

  private parseYAML(content: string, result: ParsedCode): void {
    // Extract top-level keys from YAML
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const keyMatch = line.match(/^(\w+):/);
      if (keyMatch) {
        result.variables.push({
          name: keyMatch[1],
          line: index + 1,
          column: 0,
          kind: 'const',
          isExported: true
        });
      }
    });
  }

  private parseCSS(content: string, result: ParsedCode): void {
    // Extract CSS selectors
    const selectorRegex = /^([.#]?\w[\w-]*(?:\s*,\s*[.#]?\w[\w-]*)*)\s*{/gm;
    const lines = content.split('\n');
    let match;

    while ((match = selectorRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      result.variables.push({
        name: match[1].trim(),
        line: lineNumber,
        column: 0,
        kind: 'const',
        isExported: true
      });
    }
  }

  private parseHTML(content: string, result: ParsedCode): void {
    // Extract IDs and classes
    const idRegex = /id=["']([^"']+)["']/g;
    const classRegex = /class=["']([^"']+)["']/g;
    
    let match;
    while ((match = idRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      result.variables.push({
        name: `#${match[1]}`,
        line: lineNumber,
        column: 0,
        kind: 'const',
        isExported: true
      });
    }

    while ((match = classRegex.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const classes = match[1].split(/\s+/);
      for (const cls of classes) {
        if (cls) {
          result.variables.push({
            name: `.${cls}`,
            line: lineNumber,
            column: 0,
            kind: 'const',
            isExported: true
          });
        }
      }
    }
  }

  private parseGeneric(content: string, result: ParsedCode): void {
    // Basic line metrics only
    result.metrics.linesOfCode = content.split('\n').length;
  }

  // ============================================
  // Helper Methods
  // ============================================

  private parseParameters(paramString: string): ParameterInfo[] {
    if (!paramString?.trim()) return [];

    const params: ParameterInfo[] = [];
    const parts = this.splitParams(paramString);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      // Handle destructuring
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        params.push({
          name: trimmed,
          optional: trimmed.includes('?'),
          type: undefined
        });
        continue;
      }

      const optional = trimmed.includes('?');
      const hasDefault = trimmed.includes('=');
      
      const match = trimmed.match(/^(\w+)(\?)?(?:\s*:\s*([^=]+))?(?:\s*=\s*(.+))?$/);
      if (match) {
        params.push({
          name: match[1],
          type: match[3]?.trim(),
          optional: optional || hasDefault,
          defaultValue: match[4]?.trim()
        });
      }
    }

    return params;
  }

  private splitParams(paramString: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of paramString) {
      if (char === '<' || char === '(' || char === '{' || char === '[') {
        depth++;
      } else if (char === '>' || char === ')' || char === '}' || char === ']') {
        depth--;
      } else if (char === ',' && depth === 0) {
        parts.push(current);
        current = '';
        continue;
      }
      current += char;
    }

    if (current.trim()) {
      parts.push(current);
    }

    return parts;
  }

  private findClosingBrace(lines: string[], startIndex: number): number | undefined {
    let depth = 0;
    let foundOpening = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      for (const char of line) {
        if (char === '{') {
          depth++;
          foundOpening = true;
        } else if (char === '}') {
          depth--;
          if (foundOpening && depth === 0) {
            return i + 1;
          }
        }
      }
    }

    return undefined;
  }

  private findExpressionEnd(lines: string[], startIndex: number): number | undefined {
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.endsWith(';') || (i > startIndex && !line)) {
        return i + 1;
      }
    }
    return undefined;
  }

  // ============================================
  // Metrics Calculation
  // ============================================

  private getEmptyMetrics(): ComplexityMetrics {
    return {
      cyclomaticComplexity: 1,
      cognitiveComplexity: 0,
      linesOfCode: 0,
      linesOfComments: 0,
      blankLines: 0,
      maintainabilityIndex: 100
    };
  }

  private calculateMetrics(content: string, parsed: ParsedCode): ComplexityMetrics {
    const lines = content.split('\n');
    let linesOfCode = 0;
    let linesOfComments = 0;
    let blankLines = 0;
    let cyclomaticComplexity = 1;
    let cognitiveComplexity = 0;

    // Decision keywords that increase cyclomatic complexity
    const decisionKeywords = /\b(if|else|switch|case|for|while|do|catch|&&|\|\||\?:?)\b/g;
    
    // Nesting keywords that increase cognitive complexity
    const nestingKeywords = /\b(if|else|switch|for|while|do|try|catch)\b/g;

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '') {
        blankLines++;
      } else if (
        trimmed.startsWith('//') || 
        trimmed.startsWith('/*') || 
        trimmed.startsWith('*') ||
        trimmed.startsWith('#')
      ) {
        linesOfComments++;
      } else {
        linesOfCode++;
        
        // Count cyclomatic complexity
        const decisionMatches = trimmed.match(decisionKeywords);
        if (decisionMatches) {
          cyclomaticComplexity += decisionMatches.length;
        }

        // Count cognitive complexity (simplified)
        const nestingMatches = trimmed.match(nestingKeywords);
        if (nestingMatches) {
          cognitiveComplexity += nestingMatches.length;
        }
      }
    }

    // Calculate maintainability index (simplified version)
    // MI = 171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)
    // Simplified: Higher is better (0-100 scale)
    const maintainabilityIndex = Math.max(0, Math.min(100,
      100 - (cyclomaticComplexity * 2) - (Math.log(linesOfCode + 1) * 5)
    ));

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      linesOfCode,
      linesOfComments,
      blankLines,
      maintainabilityIndex: Math.round(maintainabilityIndex)
    };
  }

  // ============================================
  // Code Smell Detection
  // ============================================

  private detectCodeSmells(content: string, parsed: ParsedCode): CodeSmell[] {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Long functions
    for (const func of parsed.functions) {
      if (func.endLine && func.line) {
        const length = func.endLine - func.line;
        if (length > this.options.maxFunctionLength) {
          smells.push({
            type: 'long-function',
            severity: length > this.options.maxFunctionLength * 2 ? 'error' : 'warning',
            message: `Function '${func.name}' is ${length} lines long (max: ${this.options.maxFunctionLength})`,
            line: func.line,
            suggestion: 'Consider breaking this function into smaller, more focused functions'
          });
        }
      }

      // Long parameter list
      if (func.parameters.length > this.options.maxParameters) {
        smells.push({
          type: 'long-parameter-list',
          severity: 'warning',
          message: `Function '${func.name}' has ${func.parameters.length} parameters (max: ${this.options.maxParameters})`,
          line: func.line,
          suggestion: 'Consider using an options object or refactoring'
        });
      }
    }

    // God classes
    for (const cls of parsed.classes) {
      const methodCount = cls.methods.length;
      const propCount = cls.properties.length;
      if (methodCount > 20 || propCount > 15) {
        smells.push({
          type: 'god-class',
          severity: 'warning',
          message: `Class '${cls.name}' may be a God class (${methodCount} methods, ${propCount} properties)`,
          line: cls.line,
          suggestion: 'Consider splitting this class following Single Responsibility Principle'
        });
      }
    }

    // Deeply nested code
    let maxNesting = 0;
    let maxNestingLine = 0;
    let currentNesting = 0;

    lines.forEach((line, index) => {
      for (const char of line) {
        if (char === '{') {
          currentNesting++;
          if (currentNesting > maxNesting) {
            maxNesting = currentNesting;
            maxNestingLine = index + 1;
          }
        } else if (char === '}') {
          currentNesting--;
        }
      }
    });

    if (maxNesting > this.options.maxNestingDepth) {
      smells.push({
        type: 'deeply-nested',
        severity: 'warning',
        message: `Code is nested ${maxNesting} levels deep (max: ${this.options.maxNestingDepth})`,
        line: maxNestingLine,
        suggestion: 'Consider using early returns, extracting methods, or flattening conditions'
      });
    }

    // Magic numbers
    const magicNumberRegex = /(?<![.\w])(-?\d+\.?\d*)(?![.\w])/g;
    const allowedNumbers = new Set(['0', '1', '-1', '2', '100', '1000']);

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Skip comments and string literals
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      
      let match;
      while ((match = magicNumberRegex.exec(trimmed)) !== null) {
        const num = match[1];
        if (!allowedNumbers.has(num) && !trimmed.includes('const ') && !trimmed.includes('enum ')) {
          // Check it's not part of a variable name or property
          const before = trimmed.substring(0, match.index);
          if (!before.endsWith('.') && !before.endsWith('[')) {
            smells.push({
              type: 'magic-number',
              severity: 'info',
              message: `Magic number '${num}' found`,
              line: index + 1,
              column: match.index,
              suggestion: 'Consider extracting to a named constant'
            });
          }
        }
      }
    });

    return smells;
  }
}

// ============================================
// Singleton Export
// ============================================

export const codeParser = new CodeParser();

export default CodeParser;
