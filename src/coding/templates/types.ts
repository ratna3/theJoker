/**
 * The Joker - Agentic Terminal
 * Template System Types
 */

import { Framework } from '../../types';

// ============================================
// Base Template Types
// ============================================

/**
 * Base options for all templates
 */
export interface TemplateOptions {
  /** Use TypeScript */
  typescript?: boolean;
  /** Include comments */
  includeComments?: boolean;
  /** Include JSDoc/docstrings */
  includeDocumentation?: boolean;
  /** Additional context or notes */
  context?: string;
}

/**
 * Result of template generation
 */
export interface TemplateResult {
  /** Generated code */
  code: string;
  /** Suggested file name */
  fileName: string;
  /** Code language */
  language: 'typescript' | 'javascript' | 'python' | 'css' | 'scss' | 'json';
  /** Required npm/pip packages */
  dependencies: string[];
  /** Additional files (e.g., CSS, tests) */
  additionalFiles?: {
    fileName: string;
    code: string;
    language: string;
  }[];
}

/**
 * Template definition interface
 */
export interface Template<T extends TemplateOptions = TemplateOptions> {
  /** Template name/identifier */
  name: string;
  /** Template description */
  description: string;
  /** Framework this template is for */
  framework: Framework;
  /** Primary language */
  language: 'typescript' | 'javascript' | 'python';
  /** Generate code from options */
  generate(options: T): TemplateResult;
  /** Get required dependencies */
  getDependencies(options: T): string[];
}

// ============================================
// Component Template Types
// ============================================

/**
 * Property definition for components
 */
export interface PropDefinition {
  /** Property name */
  name: string;
  /** TypeScript/PropTypes type */
  type: string;
  /** Is required */
  required: boolean;
  /** Default value */
  defaultValue?: string;
  /** Property description */
  description?: string;
}

/**
 * State definition for stateful components
 */
export interface StateDefinition {
  /** State variable name */
  name: string;
  /** State type */
  type: string;
  /** Initial value */
  initialValue: string;
  /** Setter function name */
  setterName?: string;
  /** Description */
  description?: string;
}

/**
 * Method definition for classes/services
 */
export interface MethodDefinition {
  /** Method name */
  name: string;
  /** Method parameters */
  params: { name: string; type: string; optional?: boolean }[];
  /** Return type */
  returnType: string;
  /** Is async method */
  async?: boolean;
  /** Method description */
  description?: string;
  /** Access modifier */
  access?: 'public' | 'private' | 'protected';
}

// ============================================
// API Template Types
// ============================================

/**
 * API endpoint definition
 */
export interface EndpointDefinition {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Route path */
  path: string;
  /** Endpoint description */
  description?: string;
  /** Request body type */
  requestBody?: string;
  /** Response type */
  responseType?: string;
  /** Requires authentication */
  authenticated?: boolean;
  /** Validation rules */
  validation?: Record<string, string>;
}

/**
 * API route options
 */
export interface ApiRouteOptions extends TemplateOptions {
  /** Route name/resource */
  routeName: string;
  /** Base path */
  basePath?: string;
  /** Endpoints to generate */
  endpoints: EndpointDefinition[];
  /** Include middleware */
  middleware?: string[];
}

// ============================================
// Page Template Types
// ============================================

/**
 * Page template options
 */
export interface PageOptions extends TemplateOptions {
  /** Page name */
  pageName: string;
  /** Page route/path */
  route: string;
  /** Page title for SEO */
  title?: string;
  /** Page description for SEO */
  description?: string;
  /** Data fetching method */
  dataFetching?: 'static' | 'server' | 'client' | 'isr';
  /** Layout to use */
  layout?: string;
  /** Include loading state */
  withLoading?: boolean;
  /** Include error boundary */
  withErrorBoundary?: boolean;
}

// ============================================
// Project Template Types
// ============================================

/**
 * Project scaffold options
 */
export interface ProjectOptions extends TemplateOptions {
  /** Project name */
  projectName: string;
  /** Framework */
  framework: Framework;
  /** Features to include */
  features: string[];
  /** Styling solution */
  styling?: 'css' | 'scss' | 'tailwind' | 'styled-components' | 'emotion';
  /** Testing framework */
  testing?: 'jest' | 'vitest' | 'cypress' | 'playwright';
  /** State management */
  stateManagement?: 'redux' | 'zustand' | 'jotai' | 'context' | 'none';
  /** Linting/formatting */
  linting?: boolean;
  /** CI/CD config */
  cicd?: 'github-actions' | 'gitlab-ci' | 'none';
}

// ============================================
// Template Registry Types
// ============================================

/**
 * Template category
 */
export type TemplateCategory = 
  | 'component' 
  | 'page' 
  | 'api' 
  | 'hook' 
  | 'context' 
  | 'utility' 
  | 'config' 
  | 'test';

/**
 * Template metadata
 */
export interface TemplateMetadata {
  name: string;
  description: string;
  category: TemplateCategory;
  framework: Framework;
  tags: string[];
  version: string;
}

/**
 * Template registry entry
 */
export interface TemplateRegistryEntry<T extends TemplateOptions = TemplateOptions> {
  metadata: TemplateMetadata;
  template: Template<T>;
}

// ============================================
// Template Helper Types
// ============================================

/**
 * Code generation context
 */
export interface GenerationContext {
  /** Project root path */
  projectRoot?: string;
  /** Current file path */
  currentFile?: string;
  /** Available imports */
  availableImports?: string[];
  /** Project type/framework */
  projectType?: Framework;
  /** TypeScript enabled */
  typescript?: boolean;
}

/**
 * Import statement structure
 */
export interface ImportStatement {
  /** Module path */
  from: string;
  /** Default import name */
  default?: string;
  /** Named imports */
  named?: string[];
  /** Namespace import */
  namespace?: string;
  /** Type-only import */
  typeOnly?: boolean;
}

/**
 * Export statement structure
 */
export interface ExportStatement {
  /** Export name */
  name: string;
  /** Is default export */
  isDefault?: boolean;
  /** Export as different name */
  as?: string;
  /** Type-only export */
  typeOnly?: boolean;
}
