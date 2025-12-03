/**
 * The Joker - Agentic Terminal
 * Code Generation Engine
 * 
 * Provides LLM-powered code generation with framework templates,
 * validation, and multi-file generation support.
 */

import { EventEmitter } from 'events';
import { LMStudioClient, lmStudioClient } from '../llm/client';
import { 
  CodeSpec, 
  GeneratedCode, 
  ValidationResult, 
  ValidationError,
  Framework,
  ChatMessage 
} from '../types';
import { logger } from '../utils/logger';

// ============================================
// Code Generation Types
// ============================================

/**
 * Extended code specification for generation
 */
export interface ExtendedCodeSpec extends CodeSpec {
  /** Name for the generated component/file */
  name?: string;
  /** Additional context or requirements */
  context?: string;
  /** Whether to include tests */
  includeTests?: boolean;
  /** Props/parameters for components */
  props?: PropSpec[];
  /** State for stateful components */
  state?: StateSpec[];
  /** API methods for services */
  methods?: MethodSpec[];
}

export interface PropSpec {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface StateSpec {
  name: string;
  type: string;
  initialValue: string;
  description?: string;
}

export interface MethodSpec {
  name: string;
  params: { name: string; type: string }[];
  returnType: string;
  description?: string;
  async?: boolean;
}

/**
 * Multi-file project specification
 */
export interface ProjectGenerationSpec {
  name: string;
  description: string;
  framework: Framework;
  language: 'typescript' | 'javascript';
  features: string[];
  structure?: FileStructureSpec[];
}

export interface FileStructureSpec {
  path: string;
  type: CodeSpec['type'];
  description: string;
  dependsOn?: string[];
}

/**
 * Generation result with metadata
 */
export interface GenerationResult {
  success: boolean;
  code: GeneratedCode | null;
  validation: ValidationResult;
  generationTimeMs: number;
  tokensUsed?: number;
  retries: number;
}

/**
 * Multi-file generation result
 */
export interface MultiFileResult {
  success: boolean;
  files: GeneratedCode[];
  validation: ValidationResult;
  generationTimeMs: number;
  errors: string[];
}

// ============================================
// Code Generator Class
// ============================================

/**
 * LLM-powered code generator with validation and templates
 */
export class CodeGenerator extends EventEmitter {
  private llm: LMStudioClient;
  private maxRetries: number = 3;
  private validationEnabled: boolean = true;

  constructor(llmClient?: LMStudioClient) {
    super();
    this.llm = llmClient || lmStudioClient;
    logger.debug('CodeGenerator initialized');
  }

  // ============================================
  // Main Generation Methods
  // ============================================

  /**
   * Generate code from a specification
   */
  async generate(spec: ExtendedCodeSpec): Promise<GenerationResult> {
    const startTime = Date.now();
    let retries = 0;
    let lastError: string | null = null;

    logger.info('Starting code generation', {
      type: spec.type,
      framework: spec.framework,
      language: spec.language
    });

    while (retries <= this.maxRetries) {
      try {
        // Build the generation prompt
        const prompt = this.buildGenerationPrompt(spec);
        const systemPrompt = this.buildSystemPrompt(spec);

        // Generate code via LLM
        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ];

        const response = await this.llm.chat(messages);
        
        // Extract code from response
        const generatedCode = this.extractCode(response.content, spec);

        // Validate if enabled
        let validation: ValidationResult = { valid: true, errors: [] };
        if (this.validationEnabled) {
          validation = await this.validateGenerated(generatedCode.content, spec.language);
        }

        // If validation failed and we have retries left, try again
        if (!validation.valid && retries < this.maxRetries) {
          lastError = validation.errors.map(e => e.message).join(', ');
          retries++;
          logger.warn(`Code validation failed, retrying (${retries}/${this.maxRetries})`, {
            errors: validation.errors
          });
          continue;
        }

        const result: GenerationResult = {
          success: validation.valid,
          code: generatedCode,
          validation,
          generationTimeMs: Date.now() - startTime,
          tokensUsed: response.usage?.totalTokens,
          retries
        };

        this.emit('generated', result);
        logger.info('Code generation complete', {
          success: result.success,
          timeMs: result.generationTimeMs,
          retries: result.retries
        });

        return result;

      } catch (error) {
        lastError = (error as Error).message;
        retries++;
        
        if (retries > this.maxRetries) {
          logger.error('Code generation failed after retries', { error: lastError });
          break;
        }
        
        logger.warn(`Generation attempt failed, retrying (${retries}/${this.maxRetries})`, {
          error: lastError
        });
        
        // Brief delay before retry
        await this.delay(500 * retries);
      }
    }

    // Return failure result
    return {
      success: false,
      code: null,
      validation: {
        valid: false,
        errors: [{ message: lastError || 'Generation failed' }]
      },
      generationTimeMs: Date.now() - startTime,
      retries
    };
  }

  /**
   * Generate multiple files at once
   */
  async generateMultiple(specs: ExtendedCodeSpec[]): Promise<MultiFileResult> {
    const startTime = Date.now();
    const files: GeneratedCode[] = [];
    const errors: string[] = [];
    const allValidationErrors: ValidationError[] = [];

    logger.info('Starting multi-file generation', { fileCount: specs.length });

    for (const spec of specs) {
      const result = await this.generate(spec);
      
      if (result.success && result.code) {
        files.push(result.code);
      } else {
        const errorMsg = result.validation.errors.map(e => e.message).join(', ');
        errors.push(`Failed to generate ${spec.name || spec.type}: ${errorMsg}`);
        allValidationErrors.push(...result.validation.errors);
      }
    }

    const result: MultiFileResult = {
      success: errors.length === 0,
      files,
      validation: {
        valid: allValidationErrors.length === 0,
        errors: allValidationErrors
      },
      generationTimeMs: Date.now() - startTime,
      errors
    };

    this.emit('multiGenerated', result);
    logger.info('Multi-file generation complete', {
      success: result.success,
      filesGenerated: files.length,
      failedFiles: errors.length
    });

    return result;
  }

  /**
   * Generate a complete project structure
   */
  async generateProject(projectSpec: ProjectGenerationSpec): Promise<MultiFileResult> {
    const startTime = Date.now();
    
    logger.info('Starting project generation', {
      name: projectSpec.name,
      framework: projectSpec.framework
    });

    // First, plan the file structure using LLM
    const structure = await this.planProjectStructure(projectSpec);
    
    // Generate each file
    const specs: ExtendedCodeSpec[] = structure.map(file => ({
      type: file.type,
      framework: projectSpec.framework,
      language: projectSpec.language,
      description: file.description,
      name: file.path.split('/').pop()?.replace(/\.\w+$/, ''),
      context: `Part of ${projectSpec.name} project. File path: ${file.path}`
    }));

    const result = await this.generateMultiple(specs);

    // Update file paths based on structure
    result.files.forEach((file, index) => {
      if (structure[index]) {
        file.filePath = structure[index].path;
      }
    });

    result.generationTimeMs = Date.now() - startTime;

    logger.info('Project generation complete', {
      name: projectSpec.name,
      filesGenerated: result.files.length
    });

    return result;
  }

  // ============================================
  // Validation Methods
  // ============================================

  /**
   * Validate generated code
   */
  async validateGenerated(
    code: string, 
    language: string
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    // Syntax validation
    const syntaxResult = this.validateSyntax(code, language);
    errors.push(...syntaxResult.errors);

    // Import validation
    const importResult = this.validateImports(code, language);
    errors.push(...importResult.errors);

    // Basic code quality checks
    const qualityResult = this.validateCodeQuality(code, language);
    errors.push(...qualityResult.errors);

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate syntax based on language
   */
  validateSyntax(code: string, language: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // Check for basic syntax issues
      const jsErrors = this.validateJSSyntax(code);
      errors.push(...jsErrors);
    } else if (language === 'python') {
      const pyErrors = this.validatePythonSyntax(code);
      errors.push(...pyErrors);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate JavaScript/TypeScript syntax
   */
  private validateJSSyntax(code: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check for unmatched brackets/braces
    const brackets = this.checkBracketBalance(code);
    if (!brackets.balanced) {
      errors.push({
        message: `Unmatched ${brackets.type}: expected ${brackets.expected}, found ${brackets.found}`,
        code: 'BRACKET_MISMATCH'
      });
    }

    // Check for unclosed strings
    const strings = this.checkStringClosure(code);
    if (!strings.closed) {
      errors.push({
        message: 'Unclosed string literal',
        line: strings.line,
        code: 'UNCLOSED_STRING'
      });
    }

    // Check for common syntax patterns that indicate issues
    const syntaxPatterns = [
      { pattern: /\bfunction\s+\(/, message: 'Missing function name' },
      { pattern: /\}\s*else\s*\{[^}]*$/, message: 'Possible unclosed else block' },
      { pattern: /import\s+{[^}]*$/, message: 'Unclosed import statement' },
      { pattern: /export\s+default\s*$/, message: 'Incomplete export default' }
    ];

    for (const { pattern, message } of syntaxPatterns) {
      if (pattern.test(code)) {
        errors.push({ message, code: 'SYNTAX_PATTERN' });
      }
    }

    return errors;
  }

  /**
   * Validate Python syntax
   */
  private validatePythonSyntax(code: string): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check indentation consistency
    const lines = code.split('\n');
    let expectedIndent = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      
      // Check for mixed tabs and spaces
      if (/^\t+ +/.test(line) || /^ +\t+/.test(line)) {
        errors.push({
          message: 'Mixed tabs and spaces in indentation',
          line: i + 1,
          code: 'MIXED_INDENT'
        });
      }
    }

    // Check for common Python syntax issues
    const syntaxPatterns = [
      { pattern: /\bdef\s+\w+\s*[^(]/, message: 'Missing parentheses in function definition' },
      { pattern: /\bclass\s+\w+\s*[^:(]/, message: 'Invalid class definition' },
      { pattern: /:\s*\n\s*\n/, message: 'Empty block after colon' }
    ];

    for (const { pattern, message } of syntaxPatterns) {
      if (pattern.test(code)) {
        errors.push({ message, code: 'PYTHON_SYNTAX' });
      }
    }

    return errors;
  }

  /**
   * Check bracket balance
   */
  private checkBracketBalance(code: string): { 
    balanced: boolean; 
    type?: string; 
    expected?: number; 
    found?: number 
  } {
    const brackets: Record<string, number> = {
      '(': 0, ')': 0,
      '[': 0, ']': 0,
      '{': 0, '}': 0
    };

    // Remove strings and comments to avoid false positives
    const cleaned = code
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/'[^']*'/g, '')
      .replace(/"[^"]*"/g, '')
      .replace(/`[^`]*`/g, '');

    for (const char of cleaned) {
      if (char in brackets) {
        brackets[char]++;
      }
    }

    // Check matching pairs
    if (brackets['('] !== brackets[')']) {
      return { 
        balanced: false, 
        type: 'parentheses', 
        expected: brackets['('], 
        found: brackets[')'] 
      };
    }
    if (brackets['['] !== brackets[']']) {
      return { 
        balanced: false, 
        type: 'square brackets', 
        expected: brackets['['], 
        found: brackets[']'] 
      };
    }
    if (brackets['{'] !== brackets['}']) {
      return { 
        balanced: false, 
        type: 'curly braces', 
        expected: brackets['{'], 
        found: brackets['}'] 
      };
    }

    return { balanced: true };
  }

  /**
   * Check for unclosed strings
   */
  private checkStringClosure(code: string): { closed: boolean; line?: number } {
    const lines = code.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip comments
      if (line.trim().startsWith('//') || line.trim().startsWith('#')) continue;
      
      // Count quotes (simplified check)
      const singleQuotes = (line.match(/(?<!\\)'/g) || []).length;
      const doubleQuotes = (line.match(/(?<!\\)"/g) || []).length;
      
      // Template literals span multiple lines, so skip backtick check here
      if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0) {
        // Check if it's a multi-line string continuation
        if (!line.includes('`')) {
          return { closed: false, line: i + 1 };
        }
      }
    }

    return { closed: true };
  }

  /**
   * Validate imports
   */
  validateImports(code: string, language: string): ValidationResult {
    const errors: ValidationError[] = [];

    if (language === 'typescript' || language === 'javascript') {
      // Check for duplicate imports
      const importMatches = code.matchAll(/import\s+(?:{[^}]+}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/g);
      const importedModules = new Set<string>();
      
      for (const match of importMatches) {
        const moduleName = match[1];
        if (importedModules.has(moduleName)) {
          errors.push({
            message: `Duplicate import from '${moduleName}'`,
            code: 'DUPLICATE_IMPORT'
          });
        }
        importedModules.add(moduleName);
      }

      // Check for empty imports
      if (/import\s*{\s*}\s*from/.test(code)) {
        errors.push({
          message: 'Empty import statement',
          code: 'EMPTY_IMPORT'
        });
      }
    } else if (language === 'python') {
      // Check for Python import issues
      const importMatches = code.matchAll(/^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm);
      const importedModules = new Set<string>();
      
      for (const match of importMatches) {
        const module = match[1] || match[2].split(',')[0].trim();
        if (importedModules.has(module)) {
          errors.push({
            message: `Duplicate import of '${module}'`,
            code: 'DUPLICATE_IMPORT'
          });
        }
        importedModules.add(module);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate basic code quality
   */
  private validateCodeQuality(code: string, language: string): ValidationResult {
    const errors: ValidationError[] = [];

    // Check for empty code
    if (!code.trim()) {
      errors.push({
        message: 'Generated code is empty',
        code: 'EMPTY_CODE'
      });
      return { valid: false, errors };
    }

    // Check minimum length
    if (code.trim().length < 10) {
      errors.push({
        message: 'Generated code is too short',
        code: 'CODE_TOO_SHORT'
      });
    }

    // Check for placeholder comments
    const placeholderPatterns = [
      /\/\/\s*TODO:?\s*implement/i,
      /\/\/\s*FIXME/i,
      /#\s*TODO:?\s*implement/i,
      /pass\s*#\s*placeholder/i,
      /throw new Error\(['"]Not implemented['"]\)/
    ];

    for (const pattern of placeholderPatterns) {
      if (pattern.test(code)) {
        errors.push({
          message: 'Code contains placeholder or unimplemented sections',
          code: 'PLACEHOLDER_CODE'
        });
        break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ============================================
  // Prompt Building Methods
  // ============================================

  /**
   * Build system prompt for code generation
   */
  private buildSystemPrompt(spec: ExtendedCodeSpec): string {
    const frameworkGuidelines = this.getFrameworkGuidelines(spec.framework);
    const languageGuidelines = this.getLanguageGuidelines(spec.language);

    return `You are an expert ${spec.language} developer specializing in ${spec.framework || 'modern web development'}.

GUIDELINES:
${languageGuidelines}
${frameworkGuidelines}

CODE REQUIREMENTS:
- Write clean, production-ready code
- Include proper imports and type definitions
- Follow best practices and conventions
- Add brief inline comments for complex logic
- Ensure code is syntactically correct and complete
- No placeholder comments like "// TODO: implement"

OUTPUT FORMAT:
- Return ONLY the code
- Wrap code in a single markdown code block with the language identifier
- Do not include explanations before or after the code block`;
  }

  /**
   * Build the generation prompt
   */
  private buildGenerationPrompt(spec: ExtendedCodeSpec): string {
    let prompt = `Generate a ${spec.type}`;
    
    if (spec.name) {
      prompt += ` named "${spec.name}"`;
    }
    
    if (spec.framework) {
      prompt += ` using ${spec.framework}`;
    }
    
    prompt += ` in ${spec.language}.`;
    
    if (spec.description) {
      prompt += `\n\nDescription: ${spec.description}`;
    }

    if (spec.props && spec.props.length > 0) {
      prompt += '\n\nProps:\n';
      for (const prop of spec.props) {
        prompt += `- ${prop.name}: ${prop.type}${prop.required ? ' (required)' : ' (optional)'}`;
        if (prop.description) prompt += ` - ${prop.description}`;
        prompt += '\n';
      }
    }

    if (spec.state && spec.state.length > 0) {
      prompt += '\n\nState:\n';
      for (const state of spec.state) {
        prompt += `- ${state.name}: ${state.type} = ${state.initialValue}`;
        if (state.description) prompt += ` - ${state.description}`;
        prompt += '\n';
      }
    }

    if (spec.methods && spec.methods.length > 0) {
      prompt += '\n\nMethods:\n';
      for (const method of spec.methods) {
        const params = method.params.map(p => `${p.name}: ${p.type}`).join(', ');
        prompt += `- ${method.async ? 'async ' : ''}${method.name}(${params}): ${method.returnType}`;
        if (method.description) prompt += ` - ${method.description}`;
        prompt += '\n';
      }
    }

    if (spec.dependencies && spec.dependencies.length > 0) {
      prompt += `\n\nDependencies: ${spec.dependencies.join(', ')}`;
    }

    if (spec.context) {
      prompt += `\n\nAdditional Context: ${spec.context}`;
    }

    if (spec.includeTests) {
      prompt += '\n\nInclude comprehensive unit tests.';
    }

    return prompt;
  }

  /**
   * Get framework-specific guidelines
   */
  private getFrameworkGuidelines(framework?: Framework): string {
    const guidelines: Record<Framework, string> = {
      react: `
REACT GUIDELINES:
- Use functional components with hooks
- Prefer useState, useEffect, useMemo, useCallback
- Use TypeScript interfaces for props
- Export components as default
- Follow React naming conventions (PascalCase for components)`,
      
      nextjs: `
NEXT.JS GUIDELINES:
- Use App Router conventions (app directory)
- Server Components by default, add 'use client' when needed
- Use Next.js specific hooks (useRouter, useParams, etc.)
- Proper metadata exports for SEO
- Follow Next.js file naming conventions`,
      
      vue: `
VUE 3 GUIDELINES:
- Use Composition API with script setup
- Use defineProps and defineEmits
- Reactive refs with ref() and reactive()
- Computed properties with computed()
- Follow Vue naming conventions`,
      
      express: `
EXPRESS GUIDELINES:
- Use async/await for route handlers
- Proper error handling middleware
- Input validation
- Use Router for modular routes
- RESTful API conventions`,
      
      nestjs: `
NESTJS GUIDELINES:
- Use decorators (@Controller, @Injectable, etc.)
- Dependency injection patterns
- DTOs for validation
- Guards and Interceptors when needed
- Module-based architecture`,
      
      node: `
NODE.JS GUIDELINES:
- Use ES modules (import/export)
- Async/await for async operations
- Proper error handling
- Environment variable management
- Clean module exports`
    };

    return framework ? guidelines[framework] : '';
  }

  /**
   * Get language-specific guidelines
   */
  private getLanguageGuidelines(language: string): string {
    const guidelines: Record<string, string> = {
      typescript: `
TYPESCRIPT GUIDELINES:
- Use explicit type annotations
- Define interfaces for complex types
- Use strict TypeScript features
- Avoid 'any' type when possible
- Use union types and generics appropriately`,
      
      javascript: `
JAVASCRIPT GUIDELINES:
- Use modern ES6+ syntax
- Destructuring and spread operators
- Arrow functions where appropriate
- Proper async/await usage
- JSDoc comments for documentation`,
      
      python: `
PYTHON GUIDELINES:
- Follow PEP 8 style guide
- Use type hints
- Proper docstrings
- Context managers where appropriate
- List/dict comprehensions when readable`
    };

    return guidelines[language] || '';
  }

  // ============================================
  // Code Extraction Methods
  // ============================================

  /**
   * Extract code from LLM response
   */
  private extractCode(response: string, spec: ExtendedCodeSpec): GeneratedCode {
    // Try to extract code from markdown code block
    const codeBlockMatch = response.match(/```(?:\w+)?\n([\s\S]*?)```/);
    let code = codeBlockMatch ? codeBlockMatch[1].trim() : response.trim();

    // If no code block found, try to clean up the response
    if (!codeBlockMatch) {
      // Remove common preamble patterns
      code = code
        .replace(/^Here['']?s?\s+(?:the\s+)?(?:code|implementation)[:\s]*/i, '')
        .replace(/^(?:Sure|Certainly)[,!]?\s*/i, '')
        .trim();
    }

    // Determine file extension
    const extension = this.getFileExtension(spec);
    const fileName = this.generateFileName(spec, extension);
    const filePath = this.generateFilePath(spec, fileName);

    // Extract dependencies from imports
    const dependencies = this.extractDependencies(code, spec.language);

    return {
      fileName,
      filePath,
      content: code,
      language: spec.language,
      dependencies,
      tests: spec.includeTests ? this.extractTests(code) : undefined
    };
  }

  /**
   * Get file extension based on spec
   */
  private getFileExtension(spec: ExtendedCodeSpec): string {
    if (spec.language === 'typescript') {
      if (spec.type === 'component' || spec.type === 'page') {
        return spec.framework === 'vue' ? '.vue' : '.tsx';
      }
      return '.ts';
    } else if (spec.language === 'javascript') {
      if (spec.type === 'component' || spec.type === 'page') {
        return spec.framework === 'vue' ? '.vue' : '.jsx';
      }
      return '.js';
    } else if (spec.language === 'python') {
      return '.py';
    }
    return '.txt';
  }

  /**
   * Generate file name from spec
   */
  private generateFileName(spec: ExtendedCodeSpec, extension: string): string {
    if (spec.name) {
      // Convert to appropriate case
      let name = spec.name;
      if (spec.type === 'component' || spec.type === 'page') {
        // PascalCase for components
        name = name.charAt(0).toUpperCase() + name.slice(1);
      } else {
        // camelCase or kebab-case for utilities
        name = name.charAt(0).toLowerCase() + name.slice(1);
      }
      return `${name}${extension}`;
    }

    // Generate name from type
    const typeNames: Record<string, string> = {
      component: 'Component',
      page: 'Page',
      api: 'api',
      utility: 'utils',
      config: 'config',
      test: 'test'
    };

    return `${typeNames[spec.type] || 'generated'}${extension}`;
  }

  /**
   * Generate file path from spec
   */
  private generateFilePath(spec: ExtendedCodeSpec, fileName: string): string {
    const basePaths: Record<string, string> = {
      component: 'src/components',
      page: spec.framework === 'nextjs' ? 'app' : 'src/pages',
      api: spec.framework === 'nextjs' ? 'app/api' : 'src/api',
      utility: 'src/utils',
      config: 'src/config',
      test: 'tests'
    };

    const basePath = basePaths[spec.type] || 'src';
    return `${basePath}/${fileName}`;
  }

  /**
   * Extract dependencies from code
   */
  private extractDependencies(code: string, language: string): string[] {
    const dependencies = new Set<string>();

    if (language === 'typescript' || language === 'javascript') {
      // Extract npm package imports
      const importMatches = code.matchAll(/import\s+.*\s+from\s+['"]([^'"./][^'"]*)['"]/g);
      for (const match of importMatches) {
        // Get the package name (handle scoped packages)
        const pkg = match[1];
        const pkgName = pkg.startsWith('@') 
          ? pkg.split('/').slice(0, 2).join('/') 
          : pkg.split('/')[0];
        dependencies.add(pkgName);
      }

      // Extract require statements
      const requireMatches = code.matchAll(/require\(['"]([^'"./][^'"]*)['"]\)/g);
      for (const match of requireMatches) {
        const pkg = match[1];
        const pkgName = pkg.startsWith('@') 
          ? pkg.split('/').slice(0, 2).join('/') 
          : pkg.split('/')[0];
        dependencies.add(pkgName);
      }
    } else if (language === 'python') {
      // Extract Python imports
      const importMatches = code.matchAll(/^(?:from\s+(\S+)|import\s+(\S+))/gm);
      for (const match of importMatches) {
        const module = (match[1] || match[2]).split('.')[0];
        // Skip standard library modules (basic check)
        const stdLib = ['os', 'sys', 'json', 're', 'datetime', 'time', 'math', 'typing', 'pathlib'];
        if (!stdLib.includes(module)) {
          dependencies.add(module);
        }
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Extract test code if present
   */
  private extractTests(code: string): string | undefined {
    // Look for test code patterns
    const testPatterns = [
      /describe\s*\(['"]/,
      /test\s*\(['"]/,
      /it\s*\(['"]/,
      /def\s+test_/,
      /class\s+Test\w+/
    ];

    if (testPatterns.some(pattern => pattern.test(code))) {
      // Code contains tests, return as is
      return code;
    }

    return undefined;
  }

  // ============================================
  // Project Structure Planning
  // ============================================

  /**
   * Plan project structure using LLM
   */
  private async planProjectStructure(spec: ProjectGenerationSpec): Promise<FileStructureSpec[]> {
    const prompt = `Plan the file structure for a ${spec.framework} project with:
- Name: ${spec.name}
- Language: ${spec.language}
- Features: ${spec.features.join(', ')}

Return a JSON array of files to generate with this exact structure:
[
  {
    "path": "relative/path/to/file.ts",
    "type": "component|page|api|utility|config",
    "description": "Brief description of what this file does"
  }
]

Only include essential files. Focus on the core functionality.`;

    try {
      const response = await this.llm.completeJSON<FileStructureSpec[]>(
        prompt,
        'You are a software architect. Return only valid JSON arrays.'
      );
      
      return response;
    } catch (error) {
      logger.warn('Failed to plan project structure, using defaults', { error });
      
      // Return default structure
      return this.getDefaultProjectStructure(spec);
    }
  }

  /**
   * Get default project structure
   */
  private getDefaultProjectStructure(spec: ProjectGenerationSpec): FileStructureSpec[] {
    const structures: Record<Framework, FileStructureSpec[]> = {
      react: [
        { path: 'src/App.tsx', type: 'component', description: 'Main App component' },
        { path: 'src/main.tsx', type: 'config', description: 'Entry point' },
        { path: 'src/components/Header.tsx', type: 'component', description: 'Header component' },
        { path: 'src/utils/helpers.ts', type: 'utility', description: 'Helper functions' }
      ],
      nextjs: [
        { path: 'app/layout.tsx', type: 'component', description: 'Root layout' },
        { path: 'app/page.tsx', type: 'page', description: 'Home page' },
        { path: 'components/Header.tsx', type: 'component', description: 'Header component' },
        { path: 'lib/utils.ts', type: 'utility', description: 'Utility functions' }
      ],
      vue: [
        { path: 'src/App.vue', type: 'component', description: 'Main App component' },
        { path: 'src/main.ts', type: 'config', description: 'Entry point' },
        { path: 'src/components/Header.vue', type: 'component', description: 'Header component' }
      ],
      express: [
        { path: 'src/index.ts', type: 'config', description: 'Entry point' },
        { path: 'src/routes/index.ts', type: 'api', description: 'Main routes' },
        { path: 'src/middleware/auth.ts', type: 'utility', description: 'Auth middleware' }
      ],
      nestjs: [
        { path: 'src/main.ts', type: 'config', description: 'Entry point' },
        { path: 'src/app.module.ts', type: 'config', description: 'App module' },
        { path: 'src/app.controller.ts', type: 'api', description: 'Main controller' },
        { path: 'src/app.service.ts', type: 'utility', description: 'Main service' }
      ],
      node: [
        { path: 'src/index.ts', type: 'config', description: 'Entry point' },
        { path: 'src/utils.ts', type: 'utility', description: 'Utility functions' }
      ]
    };

    return structures[spec.framework] || structures.node;
  }

  // ============================================
  // Configuration Methods
  // ============================================

  /**
   * Enable or disable validation
   */
  setValidation(enabled: boolean): void {
    this.validationEnabled = enabled;
    logger.debug('Validation setting changed', { enabled });
  }

  /**
   * Set maximum retries for generation
   */
  setMaxRetries(retries: number): void {
    this.maxRetries = Math.max(0, retries);
    logger.debug('Max retries set', { retries: this.maxRetries });
  }

  /**
   * Get generation statistics
   */
  getStats(): { validationEnabled: boolean; maxRetries: number } {
    return {
      validationEnabled: this.validationEnabled,
      maxRetries: this.maxRetries
    };
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// Export Singleton Instance
// ============================================

export const codeGenerator = new CodeGenerator();

export default CodeGenerator;
