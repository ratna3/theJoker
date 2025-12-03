/**
 * The Joker - Agentic Terminal
 * Template System Tests
 */

import { 
  TemplateRegistry,
  templateRegistry,
  reactTemplates,
  nextjsTemplates,
  vueTemplates,
  expressTemplates,
  reactFunctionalComponent,
  nextAppPage,
  vueCompositionComponent,
  expressApp
} from '../../../src/coding/templates';

describe('TemplateRegistry', () => {
  let registry: TemplateRegistry;

  beforeEach(() => {
    registry = new TemplateRegistry();
  });

  describe('initialization', () => {
    it('should create registry instance', () => {
      expect(registry).toBeInstanceOf(TemplateRegistry);
    });

    it('should register built-in templates', () => {
      expect(registry.size).toBeGreaterThan(0);
    });

    it('should have React templates', () => {
      const reactList = registry.findByFramework('react');
      expect(reactList.length).toBeGreaterThan(0);
    });

    it('should have Next.js templates', () => {
      const nextList = registry.findByFramework('nextjs');
      expect(nextList.length).toBeGreaterThan(0);
    });

    it('should have Vue templates', () => {
      const vueList = registry.findByFramework('vue');
      expect(vueList.length).toBeGreaterThan(0);
    });

    it('should have Express templates', () => {
      const expressList = registry.findByFramework('express');
      expect(expressList.length).toBeGreaterThan(0);
    });
  });

  describe('template retrieval', () => {
    it('should get template by name', () => {
      const template = registry.get('react-functional');
      expect(template).toBeDefined();
      expect(template?.name).toBe('react-functional');
    });

    it('should return undefined for unknown template', () => {
      const template = registry.get('unknown-template');
      expect(template).toBeUndefined();
    });

    it('should get template metadata', () => {
      const metadata = registry.getMetadata('react-functional');
      expect(metadata).toBeDefined();
      expect(metadata?.framework).toBe('react');
    });

    it('should check if template exists', () => {
      expect(registry.has('react-functional')).toBe(true);
      expect(registry.has('unknown-template')).toBe(false);
    });
  });

  describe('template search', () => {
    it('should find by category', () => {
      const components = registry.findByCategory('component');
      expect(components.length).toBeGreaterThan(0);
    });

    it('should find by tags', () => {
      const hookTemplates = registry.findByTags(['hook']);
      expect(hookTemplates.length).toBeGreaterThan(0);
    });

    it('should search by query', () => {
      const results = registry.search('functional');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should list all templates', () => {
      const list = registry.list();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
    });
  });

  describe('custom template registration', () => {
    it('should register custom template', () => {
      const customTemplate = {
        name: 'custom-template',
        description: 'Custom test template',
        framework: 'react' as const,
        language: 'typescript' as const,
        generate: () => ({
          code: 'test',
          fileName: 'test.ts',
          language: 'typescript' as const,
          dependencies: []
        }),
        getDependencies: () => []
      };

      registry.register({
        metadata: {
          name: 'custom-template',
          description: 'Custom test template',
          category: 'component',
          framework: 'react',
          tags: ['custom', 'test'],
          version: '1.0.0'
        },
        template: customTemplate
      });

      expect(registry.has('custom-template')).toBe(true);
    });
  });
});

describe('React Templates', () => {
  describe('reactFunctionalComponent', () => {
    it('should have correct metadata', () => {
      expect(reactFunctionalComponent.name).toBe('react-functional');
      expect(reactFunctionalComponent.framework).toBe('react');
      expect(reactFunctionalComponent.language).toBe('typescript');
    });

    it('should generate functional component', () => {
      const result = reactFunctionalComponent.generate({
        componentName: 'TestButton'
      });

      expect(result.code).toContain('TestButton');
      expect(result.code).toContain('React');
      expect(result.code).toContain('export default');
      expect(result.fileName).toBe('TestButton.tsx');
    });

    it('should generate component with props', () => {
      const result = reactFunctionalComponent.generate({
        componentName: 'UserCard',
        props: [
          { name: 'name', type: 'string', required: true },
          { name: 'age', type: 'number', required: false, defaultValue: '0' }
        ]
      });

      expect(result.code).toContain('interface UserCardProps');
      expect(result.code).toContain('name: string');
      expect(result.code).toContain('age?: number');
    });

    it('should generate component with hooks', () => {
      const result = reactFunctionalComponent.generate({
        componentName: 'Counter',
        hooks: ['useEffect']
      });

      expect(result.code).toContain('useEffect');
    });

    it('should return correct dependencies', () => {
      const deps = reactFunctionalComponent.getDependencies({
        componentName: 'Test'
      });

      expect(deps).toContain('react');
    });
  });

  describe('reactTemplates collection', () => {
    it('should have all React templates', () => {
      expect(reactTemplates.functional).toBeDefined();
      expect(reactTemplates.stateful).toBeDefined();
      expect(reactTemplates.hook).toBeDefined();
      expect(reactTemplates.context).toBeDefined();
    });
  });
});

describe('Next.js Templates', () => {
  describe('nextAppPage', () => {
    it('should have correct metadata', () => {
      expect(nextAppPage.name).toBe('nextjs-app-page');
      expect(nextAppPage.framework).toBe('nextjs');
    });

    it('should generate page component', () => {
      const result = nextAppPage.generate({
        pageName: 'Home',
        route: '/',
        description: 'Home page'
      });

      expect(result.code).toContain('Home');
      expect(result.code).toContain('export');
      expect(result.fileName).toContain('page');
    });

    it('should generate client component when specified', () => {
      const result = nextAppPage.generate({
        pageName: 'Dashboard',
        route: '/dashboard',
        componentType: 'client'
      });

      expect(result.code).toContain('use client');
    });

    it('should generate metadata export', () => {
      const result = nextAppPage.generate({
        pageName: 'About',
        route: '/about',
        generateMetadata: true
      });

      expect(result.code).toContain('metadata');
    });
  });

  describe('nextjsTemplates collection', () => {
    it('should have all Next.js templates', () => {
      expect(nextjsTemplates.page).toBeDefined();
      expect(nextjsTemplates.layout).toBeDefined();
      expect(nextjsTemplates.apiRoute).toBeDefined();
      expect(nextjsTemplates.serverComponent).toBeDefined();
      expect(nextjsTemplates.clientComponent).toBeDefined();
    });
  });
});

describe('Vue Templates', () => {
  describe('vueCompositionComponent', () => {
    it('should have correct metadata', () => {
      expect(vueCompositionComponent.name).toBe('vue-composition');
      expect(vueCompositionComponent.framework).toBe('vue');
    });

    it('should generate SFC with script setup', () => {
      const result = vueCompositionComponent.generate({
        componentName: 'UserProfile'
      });

      expect(result.code).toContain('<script setup');
      expect(result.code).toContain('<template>');
      expect(result.code).toContain('<style');
      expect(result.fileName).toBe('UserProfile.vue');
    });

    it('should generate with props', () => {
      const result = vueCompositionComponent.generate({
        componentName: 'Card',
        props: [
          { name: 'title', type: 'string', required: true }
        ]
      });

      expect(result.code).toContain('defineProps');
      expect(result.code).toContain('title');
    });

    it('should generate with emits', () => {
      const result = vueCompositionComponent.generate({
        componentName: 'Button',
        emits: [
          { name: 'click', payload: 'MouseEvent' }
        ]
      });

      expect(result.code).toContain('defineEmits');
    });
  });

  describe('vueTemplates collection', () => {
    it('should have all Vue templates', () => {
      expect(vueTemplates.composition).toBeDefined();
      expect(vueTemplates.options).toBeDefined();
      expect(vueTemplates.composable).toBeDefined();
      expect(vueTemplates.store).toBeDefined();
    });
  });
});

describe('Express Templates', () => {
  describe('expressApp', () => {
    it('should have correct metadata', () => {
      expect(expressApp.name).toBe('express-app');
      expect(expressApp.framework).toBe('express');
    });

    it('should generate Express app', () => {
      const result = expressApp.generate({
        appName: 'api-server'
      });

      expect(result.code).toContain('express');
      expect(result.code).toContain('app');
      expect(result.code).toContain('listen');
    });

    it('should include cors when specified', () => {
      const result = expressApp.generate({
        appName: 'api',
        cors: true
      });

      expect(result.code).toContain('cors');
    });

    it('should include helmet when specified', () => {
      const result = expressApp.generate({
        appName: 'api',
        helmet: true
      });

      expect(result.code).toContain('helmet');
    });

    it('should include error handling when specified', () => {
      const result = expressApp.generate({
        appName: 'api',
        errorHandling: true
      });

      expect(result.code).toContain('error');
    });
  });

  describe('expressTemplates collection', () => {
    it('should have all Express templates', () => {
      expect(expressTemplates.app).toBeDefined();
      expect(expressTemplates.router).toBeDefined();
      expect(expressTemplates.controller).toBeDefined();
      expect(expressTemplates.middleware).toBeDefined();
      expect(expressTemplates.service).toBeDefined();
    });
  });
});

describe('Singleton templateRegistry', () => {
  it('should export a singleton instance', () => {
    expect(templateRegistry).toBeInstanceOf(TemplateRegistry);
  });

  it('should have pre-registered templates', () => {
    expect(templateRegistry.size).toBeGreaterThan(0);
  });
});
