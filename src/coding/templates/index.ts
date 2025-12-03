/**
 * The Joker - Agentic Terminal
 * Template System - Main Export
 */

// Export types
export * from './types';

// Export React templates
export { reactTemplates } from './react';
export {
  reactFunctionalComponent,
  reactComponentWithState,
  reactCustomHook,
  reactContext
} from './react';
export type { ReactComponentOptions, ReactHookOptions, ReactContextOptions } from './react';

// Export Next.js templates
export { nextjsTemplates } from './nextjs';
export {
  nextAppPage,
  nextLayout,
  nextApiRoute,
  nextServerComponent,
  nextClientComponent,
  nextMiddleware
} from './nextjs';
export type {
  NextPageOptions,
  NextApiOptions,
  NextLayoutOptions,
  NextComponentOptions,
  NextMiddlewareOptions
} from './nextjs';

// Export Vue templates
export { vueTemplates } from './vue';
export {
  vueCompositionComponent,
  vueOptionsComponent,
  vueComposable,
  vuePiniaStore,
  vueRouter
} from './vue';
export type {
  VueComponentOptions,
  VueComposableOptions,
  VueStoreOptions,
  VueRouterOptions
} from './vue';

// Export Express/Node templates
export { expressTemplates } from './express';
export {
  expressApp,
  expressRouter,
  expressController,
  expressMiddleware,
  expressService,
  nodeUtility
} from './express';
export type {
  ExpressAppOptions,
  ExpressRouterOptions,
  ExpressControllerOptions,
  ExpressMiddlewareOptions,
  ExpressServiceOptions,
  NodeUtilityOptions
} from './express';

// ============================================
// Template Registry
// ============================================

import { Template, TemplateOptions, TemplateMetadata, TemplateCategory, TemplateRegistryEntry } from './types';
import { Framework } from '../../types';
import { reactTemplates } from './react';
import { nextjsTemplates } from './nextjs';
import { vueTemplates } from './vue';
import { expressTemplates } from './express';

/**
 * Template Registry for managing and discovering templates
 */
export class TemplateRegistry {
  private templates: Map<string, TemplateRegistryEntry<any>> = new Map();

  constructor() {
    this.registerBuiltInTemplates();
  }

  /**
   * Register all built-in templates
   */
  private registerBuiltInTemplates(): void {
    // React templates
    this.register({
      metadata: {
        name: 'react-functional',
        description: 'React functional component',
        category: 'component',
        framework: 'react',
        tags: ['react', 'component', 'functional', 'hooks'],
        version: '1.0.0'
      },
      template: reactTemplates.functional
    });

    this.register({
      metadata: {
        name: 'react-stateful',
        description: 'React stateful component',
        category: 'component',
        framework: 'react',
        tags: ['react', 'component', 'state', 'hooks'],
        version: '1.0.0'
      },
      template: reactTemplates.stateful
    });

    this.register({
      metadata: {
        name: 'react-hook',
        description: 'React custom hook',
        category: 'hook',
        framework: 'react',
        tags: ['react', 'hook', 'custom'],
        version: '1.0.0'
      },
      template: reactTemplates.hook
    });

    this.register({
      metadata: {
        name: 'react-context',
        description: 'React context with provider',
        category: 'context',
        framework: 'react',
        tags: ['react', 'context', 'provider', 'state'],
        version: '1.0.0'
      },
      template: reactTemplates.context
    });

    // Next.js templates
    this.register({
      metadata: {
        name: 'nextjs-page',
        description: 'Next.js App Router page',
        category: 'page',
        framework: 'nextjs',
        tags: ['nextjs', 'page', 'app-router'],
        version: '1.0.0'
      },
      template: nextjsTemplates.page
    });

    this.register({
      metadata: {
        name: 'nextjs-layout',
        description: 'Next.js layout component',
        category: 'component',
        framework: 'nextjs',
        tags: ['nextjs', 'layout', 'app-router'],
        version: '1.0.0'
      },
      template: nextjsTemplates.layout
    });

    this.register({
      metadata: {
        name: 'nextjs-api',
        description: 'Next.js API route handler',
        category: 'api',
        framework: 'nextjs',
        tags: ['nextjs', 'api', 'route-handler'],
        version: '1.0.0'
      },
      template: nextjsTemplates.apiRoute
    });

    this.register({
      metadata: {
        name: 'nextjs-server-component',
        description: 'Next.js server component',
        category: 'component',
        framework: 'nextjs',
        tags: ['nextjs', 'server', 'component', 'rsc'],
        version: '1.0.0'
      },
      template: nextjsTemplates.serverComponent
    });

    this.register({
      metadata: {
        name: 'nextjs-client-component',
        description: 'Next.js client component',
        category: 'component',
        framework: 'nextjs',
        tags: ['nextjs', 'client', 'component', 'use-client'],
        version: '1.0.0'
      },
      template: nextjsTemplates.clientComponent
    });

    // Vue templates
    this.register({
      metadata: {
        name: 'vue-composition',
        description: 'Vue 3 Composition API component',
        category: 'component',
        framework: 'vue',
        tags: ['vue', 'vue3', 'composition-api', 'script-setup'],
        version: '1.0.0'
      },
      template: vueTemplates.composition
    });

    this.register({
      metadata: {
        name: 'vue-options',
        description: 'Vue 3 Options API component',
        category: 'component',
        framework: 'vue',
        tags: ['vue', 'vue3', 'options-api'],
        version: '1.0.0'
      },
      template: vueTemplates.options
    });

    this.register({
      metadata: {
        name: 'vue-composable',
        description: 'Vue 3 composable function',
        category: 'hook',
        framework: 'vue',
        tags: ['vue', 'vue3', 'composable', 'hook'],
        version: '1.0.0'
      },
      template: vueTemplates.composable
    });

    this.register({
      metadata: {
        name: 'vue-pinia-store',
        description: 'Vue 3 Pinia store',
        category: 'utility',
        framework: 'vue',
        tags: ['vue', 'vue3', 'pinia', 'store', 'state'],
        version: '1.0.0'
      },
      template: vueTemplates.store
    });

    // Express templates
    this.register({
      metadata: {
        name: 'express-app',
        description: 'Express.js application',
        category: 'config',
        framework: 'express',
        tags: ['express', 'node', 'server', 'api'],
        version: '1.0.0'
      },
      template: expressTemplates.app
    });

    this.register({
      metadata: {
        name: 'express-router',
        description: 'Express.js router',
        category: 'api',
        framework: 'express',
        tags: ['express', 'router', 'routes'],
        version: '1.0.0'
      },
      template: expressTemplates.router
    });

    this.register({
      metadata: {
        name: 'express-controller',
        description: 'Express.js controller',
        category: 'api',
        framework: 'express',
        tags: ['express', 'controller', 'mvc'],
        version: '1.0.0'
      },
      template: expressTemplates.controller
    });

    this.register({
      metadata: {
        name: 'express-middleware',
        description: 'Express.js middleware',
        category: 'utility',
        framework: 'express',
        tags: ['express', 'middleware'],
        version: '1.0.0'
      },
      template: expressTemplates.middleware
    });

    this.register({
      metadata: {
        name: 'express-service',
        description: 'Express.js service',
        category: 'utility',
        framework: 'express',
        tags: ['express', 'service', 'business-logic'],
        version: '1.0.0'
      },
      template: expressTemplates.service
    });
  }

  /**
   * Register a new template
   */
  register<T extends TemplateOptions>(entry: TemplateRegistryEntry<T>): void {
    this.templates.set(entry.metadata.name, entry);
  }

  /**
   * Get a template by name
   */
  get<T extends TemplateOptions>(name: string): Template<T> | undefined {
    return this.templates.get(name)?.template;
  }

  /**
   * Get template metadata by name
   */
  getMetadata(name: string): TemplateMetadata | undefined {
    return this.templates.get(name)?.metadata;
  }

  /**
   * Find templates by framework
   */
  findByFramework(framework: Framework): TemplateRegistryEntry<any>[] {
    return Array.from(this.templates.values())
      .filter(entry => entry.metadata.framework === framework);
  }

  /**
   * Find templates by category
   */
  findByCategory(category: TemplateCategory): TemplateRegistryEntry<any>[] {
    return Array.from(this.templates.values())
      .filter(entry => entry.metadata.category === category);
  }

  /**
   * Find templates by tags
   */
  findByTags(tags: string[]): TemplateRegistryEntry<any>[] {
    return Array.from(this.templates.values())
      .filter(entry => tags.some(tag => entry.metadata.tags.includes(tag)));
  }

  /**
   * Search templates by query
   */
  search(query: string): TemplateRegistryEntry<any>[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.templates.values())
      .filter(entry => 
        entry.metadata.name.toLowerCase().includes(lowerQuery) ||
        entry.metadata.description.toLowerCase().includes(lowerQuery) ||
        entry.metadata.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
  }

  /**
   * List all registered templates
   */
  list(): TemplateMetadata[] {
    return Array.from(this.templates.values()).map(entry => entry.metadata);
  }

  /**
   * Check if a template exists
   */
  has(name: string): boolean {
    return this.templates.has(name);
  }

  /**
   * Get template count
   */
  get size(): number {
    return this.templates.size;
  }
}

// Export singleton instance
export const templateRegistry = new TemplateRegistry();

export default templateRegistry;
