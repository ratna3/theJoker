/**
 * The Joker - Agentic Terminal
 * Vue 3 Framework Templates
 */

import { Template, TemplateOptions, TemplateResult, PropDefinition, StateDefinition } from './types';

// ============================================
// Helper Functions
// ============================================

function jsType(tsType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'String',
    'number': 'Number',
    'boolean': 'Boolean',
    'object': 'Object',
    'array': 'Array',
    'function': 'Function'
  };
  return typeMap[tsType.toLowerCase()] || 'Object';
}

function formatRoutes(routes: RouteDefinition[], indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  return `[\n${routes.map(r => {
    let route = `${spaces}  {\n`;
    route += `${spaces}    path: '${r.path}',\n`;
    route += `${spaces}    name: '${r.name}',\n`;
    route += `${spaces}    component: ${r.component}`;
    if (r.meta) {
      route += `,\n${spaces}    meta: ${JSON.stringify(r.meta)}`;
    }
    if (r.children && r.children.length > 0) {
      route += `,\n${spaces}    children: ${formatRoutes(r.children, indent + 2)}`;
    }
    route += `\n${spaces}  }`;
    return route;
  }).join(',\n')}\n${spaces}]`;
}

// ============================================
// Vue Specific Options
// ============================================

export interface VueComponentOptions extends TemplateOptions {
  componentName: string;
  props?: PropDefinition[];
  emits?: EmitDefinition[];
  state?: StateDefinition[];
  computed?: ComputedDefinition[];
  methods?: MethodDefinition[];
  slots?: SlotDefinition[];
  styling?: 'scoped' | 'module' | 'none';
  scriptSetup?: boolean;
}

export interface EmitDefinition {
  name: string;
  payload?: string;
  description?: string;
}

export interface ComputedDefinition {
  name: string;
  returnType: string;
  description?: string;
}

export interface MethodDefinition {
  name: string;
  params?: { name: string; type: string }[];
  returnType?: string;
  async?: boolean;
}

export interface SlotDefinition {
  name: string;
  props?: { name: string; type: string }[];
  description?: string;
}

export interface VueComposableOptions extends TemplateOptions {
  composableName: string;
  parameters?: { name: string; type: string }[];
  returnProperties?: { name: string; type: string }[];
  withReactive?: boolean;
}

// ============================================
// Vue 3 Composition API Component Template
// ============================================

export const vueCompositionComponent: Template<VueComponentOptions> = {
  name: 'vue-composition',
  description: 'Vue 3 Composition API component with script setup',
  framework: 'vue',
  language: 'typescript',

  generate(options: VueComponentOptions): TemplateResult {
    const {
      componentName,
      props = [],
      emits = [],
      state = [],
      computed = [],
      methods = [],
      styling = 'scoped',
      scriptSetup = true,
      typescript = true
    } = options;

    // Build props definition
    const propsDefine = props.length > 0
      ? typescript
        ? `interface Props {\n${props.map(p => `  ${p.name}${p.required ? '' : '?'}: ${p.type};`).join('\n')}\n}\n\nconst props = defineProps<Props>();`
        : `const props = defineProps({\n${props.map(p => `  ${p.name}: {\n    type: ${jsType(p.type)},\n    required: ${p.required}\n  }`).join(',\n')}\n});`
      : '';

    // Build emits definition
    const emitsDefine = emits.length > 0
      ? typescript
        ? `const emit = defineEmits<{\n${emits.map(e => `  (e: '${e.name}'${e.payload ? `, payload: ${e.payload}` : ''}): void;`).join('\n')}\n}>();`
        : `const emit = defineEmits(['${emits.map(e => e.name).join("', '")}']);`
      : '';

    // Build state refs
    const stateRefs = state.map(s => {
      return `const ${s.name} = ref<${s.type}>(${s.initialValue});`;
    }).join('\n');

    // Build computed properties
    const computedProps = computed.map(c => {
      return `const ${c.name} = computed<${c.returnType}>(() => {
  // Compute ${c.name}
  return undefined as unknown as ${c.returnType};
});`;
    }).join('\n\n');

    // Build methods
    const methodDefs = methods.map(m => {
      const params = m.params?.map(p => `${p.name}: ${p.type}`).join(', ') || '';
      return `${m.async ? 'async ' : ''}function ${m.name}(${params})${m.returnType ? `: ${m.returnType}` : ''} {
  // Implement ${m.name}
}`;
    }).join('\n\n');

    // Build imports
    const imports: string[] = [];
    if (state.length > 0) imports.push('ref');
    if (computed.length > 0) imports.push('computed');
    if (methods.some(m => m.async)) imports.push('onMounted');

    const vueImport = imports.length > 0 
      ? `import { ${imports.join(', ')} } from 'vue';` 
      : '';

    const styleBlock = styling !== 'none'
      ? `\n<style ${styling === 'scoped' ? 'scoped' : 'module'}>\n.${componentName.toLowerCase()}-container {\n  /* Component styles */\n}\n</style>`
      : '';

    const code = `<script setup lang="${typescript ? 'ts' : 'js'}">
${vueImport}

${propsDefine}

${emitsDefine}

${stateRefs}

${computedProps}

${methodDefs}
</script>

<template>
  <div class="${componentName.toLowerCase()}-container">
    <h2>${componentName}</h2>
    <!-- Component content -->
  </div>
</template>
${styleBlock}
`;

    return {
      code,
      fileName: `${componentName}.vue`,
      language: 'typescript',
      dependencies: ['vue']
    };
  },

  getDependencies(): string[] {
    return ['vue'];
  }
};

// ============================================
// Vue 3 Options API Component Template
// ============================================

export const vueOptionsComponent: Template<VueComponentOptions> = {
  name: 'vue-options',
  description: 'Vue 3 Options API component',
  framework: 'vue',
  language: 'typescript',

  generate(options: VueComponentOptions): TemplateResult {
    const {
      componentName,
      props = [],
      emits = [],
      state = [],
      computed = [],
      methods = [],
      styling = 'scoped',
      typescript = true
    } = options;

    // Build props
    const propsObj = props.length > 0
      ? `  props: {\n${props.map(p => `    ${p.name}: {\n      type: ${jsType(p.type)} as PropType<${p.type}>,\n      required: ${p.required}${p.defaultValue ? `,\n      default: ${p.defaultValue}` : ''}\n    }`).join(',\n')}\n  },`
      : '';

    // Build emits
    const emitsArr = emits.length > 0
      ? `  emits: ['${emits.map(e => e.name).join("', '")}'],`
      : '';

    // Build data
    const dataFn = state.length > 0
      ? `  data() {\n    return {\n${state.map(s => `      ${s.name}: ${s.initialValue}`).join(',\n')}\n    };\n  },`
      : '';

    // Build computed
    const computedObj = computed.length > 0
      ? `  computed: {\n${computed.map(c => `    ${c.name}(): ${c.returnType} {\n      // Compute ${c.name}\n      return undefined as unknown as ${c.returnType};\n    }`).join(',\n')}\n  },`
      : '';

    // Build methods
    const methodsObj = methods.length > 0
      ? `  methods: {\n${methods.map(m => {
          const params = m.params?.map(p => `${p.name}: ${p.type}`).join(', ') || '';
          return `    ${m.async ? 'async ' : ''}${m.name}(${params})${m.returnType ? `: ${m.returnType}` : ''} {\n      // Implement ${m.name}\n    }`;
        }).join(',\n')}\n  },`
      : '';

    const styleBlock = styling !== 'none'
      ? `\n<style ${styling === 'scoped' ? 'scoped' : 'module'}>\n.${componentName.toLowerCase()}-container {\n  /* Component styles */\n}\n</style>`
      : '';

    const code = `<script lang="${typescript ? 'ts' : 'js'}">
import { defineComponent${props.length > 0 ? ', PropType' : ''} } from 'vue';

export default defineComponent({
  name: '${componentName}',
${propsObj}
${emitsArr}
${dataFn}
${computedObj}
${methodsObj}
});
</script>

<template>
  <div class="${componentName.toLowerCase()}-container">
    <h2>${componentName}</h2>
    <!-- Component content -->
  </div>
</template>
${styleBlock}
`;

    return {
      code,
      fileName: `${componentName}.vue`,
      language: 'typescript',
      dependencies: ['vue']
    };
  },

  getDependencies(): string[] {
    return ['vue'];
  }
};

// ============================================
// Vue 3 Composable Template
// ============================================

export const vueComposable: Template<VueComposableOptions> = {
  name: 'vue-composable',
  description: 'Vue 3 Composable function',
  framework: 'vue',
  language: 'typescript',

  generate(options: VueComposableOptions): TemplateResult {
    const {
      composableName,
      parameters = [],
      returnProperties = [],
      withReactive = true,
      typescript = true
    } = options;

    const imports = ['ref'];
    if (withReactive) imports.push('reactive', 'toRefs');
    imports.push('computed', 'onMounted', 'onUnmounted');

    const params = parameters.map(p => 
      typescript ? `${p.name}: ${p.type}` : p.name
    ).join(', ');

    const returnTypeProps = returnProperties.length > 0
      ? returnProperties
      : [
          { name: 'data', type: 'any' },
          { name: 'loading', type: 'boolean' },
          { name: 'error', type: 'Error | null' }
        ];

    const returnType = typescript
      ? `: {\n${returnTypeProps.map(p => `  ${p.name}: ${p.type.includes('Ref') ? p.type : `Ref<${p.type}>`}`).join(';\n')}\n}`
      : '';

    const code = `import { ${imports.join(', ')}, Ref } from 'vue';

/**
 * ${composableName}
 * ${parameters.length > 0 ? `@param ${parameters.map(p => `${p.name} - ${p.type}`).join('\n * @param ')}` : ''}
 */
export function ${composableName}(${params})${returnType} {
  const data = ref<any>(null);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  async function fetchData() {
    loading.value = true;
    error.value = null;
    
    try {
      // Implement data fetching
      await new Promise(resolve => setTimeout(resolve, 1000));
      data.value = { message: 'Data loaded' };
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Unknown error');
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    data.value = null;
    loading.value = false;
    error.value = null;
  }

  onMounted(() => {
    fetchData();
  });

  onUnmounted(() => {
    // Cleanup
  });

  return {
    data,
    loading,
    error,
    fetchData,
    reset
  };
}

export default ${composableName};
`;

    return {
      code,
      fileName: `${composableName}.ts`,
      language: 'typescript',
      dependencies: ['vue']
    };
  },

  getDependencies(): string[] {
    return ['vue'];
  }
};

// ============================================
// Vue 3 Store (Pinia) Template
// ============================================

export interface VueStoreOptions extends TemplateOptions {
  storeName: string;
  state?: StateDefinition[];
  getters?: ComputedDefinition[];
  actions?: MethodDefinition[];
}

export const vuePiniaStore: Template<VueStoreOptions> = {
  name: 'vue-pinia-store',
  description: 'Vue 3 Pinia store',
  framework: 'vue',
  language: 'typescript',

  generate(options: VueStoreOptions): TemplateResult {
    const {
      storeName,
      state = [
        { name: 'items', type: 'any[]', initialValue: '[]' },
        { name: 'loading', type: 'boolean', initialValue: 'false' }
      ],
      getters = [],
      actions = [],
      typescript = true
    } = options;

    const stateType = typescript
      ? `interface ${storeName}State {\n${state.map(s => `  ${s.name}: ${s.type};`).join('\n')}\n}\n\n`
      : '';

    const stateObj = `    state: (): ${storeName}State => ({\n${state.map(s => `      ${s.name}: ${s.initialValue}`).join(',\n')}\n    }),`;

    const gettersObj = getters.length > 0 || true
      ? `    getters: {\n      itemCount: (state) => state.items.length,\n${getters.map(g => `      ${g.name}: (state): ${g.returnType} => {\n        // Compute ${g.name}\n        return undefined as unknown as ${g.returnType};\n      }`).join(',\n')}\n    },`
      : '';

    const actionsObj = `    actions: {\n      async fetchItems() {\n        this.loading = true;\n        try {\n          // Fetch items\n          await new Promise(resolve => setTimeout(resolve, 1000));\n          this.items = [];\n        } finally {\n          this.loading = false;\n        }\n      },\n\n      addItem(item: any) {\n        this.items.push(item);\n      },\n\n      removeItem(index: number) {\n        this.items.splice(index, 1);\n      },\n\n      clearItems() {\n        this.items = [];\n      }${actions.length > 0 ? ',\n\n' + actions.map(a => {
        const params = a.params?.map(p => `${p.name}: ${p.type}`).join(', ') || '';
        return `      ${a.async ? 'async ' : ''}${a.name}(${params})${a.returnType ? `: ${a.returnType}` : ''} {\n        // Implement ${a.name}\n      }`;
      }).join(',\n\n') : ''}\n    }`;

    const code = `import { defineStore } from 'pinia';

${stateType}export const use${storeName}Store = defineStore('${storeName.toLowerCase()}', {
${stateObj}

${gettersObj}

${actionsObj}
});

export type ${storeName}Store = ReturnType<typeof use${storeName}Store>;
`;

    return {
      code,
      fileName: `${storeName.toLowerCase()}.store.ts`,
      language: 'typescript',
      dependencies: ['vue', 'pinia']
    };
  },

  getDependencies(): string[] {
    return ['vue', 'pinia'];
  }
};

// ============================================
// Vue Router Setup Template
// ============================================

export interface VueRouterOptions extends TemplateOptions {
  routes: RouteDefinition[];
  historyMode?: 'hash' | 'history';
  guards?: boolean;
}

export interface RouteDefinition {
  path: string;
  name: string;
  component: string;
  meta?: Record<string, any>;
  children?: RouteDefinition[];
}

export const vueRouter: Template<VueRouterOptions> = {
  name: 'vue-router',
  description: 'Vue Router configuration',
  framework: 'vue',
  language: 'typescript',

  generate(options: VueRouterOptions): TemplateResult {
    const {
      routes = [
        { path: '/', name: 'Home', component: 'HomeView' },
        { path: '/about', name: 'About', component: 'AboutView' }
      ],
      historyMode = 'history',
      guards = true
    } = options;

    const routeImports = routes.map(r => 
      `const ${r.component} = () => import('../views/${r.component}.vue');`
    ).join('\n');

    const routesDef = formatRoutes(routes);

    const guardsCode = guards ? `
router.beforeEach((to, from, next) => {
  // Navigation guard
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const isAuthenticated = false; // Replace with actual auth check

  if (requiresAuth && !isAuthenticated) {
    next({ name: 'Login' });
  } else {
    next();
  }
});

router.afterEach((to, from) => {
  // After navigation
  document.title = to.meta.title as string || 'App';
});
` : '';

    const code = `import { createRouter, createWebHistory, createWebHashHistory, RouteRecordRaw } from 'vue-router';

// Lazy-loaded route components
${routeImports}

const routes: RouteRecordRaw[] = ${routesDef};

const router = createRouter({
  history: ${historyMode === 'hash' ? 'createWebHashHistory()' : 'createWebHistory(import.meta.env.BASE_URL)'},
  routes
});
${guardsCode}
export default router;
`;

    return {
      code,
      fileName: 'router.ts',
      language: 'typescript',
      dependencies: ['vue', 'vue-router']
    };
  },

  getDependencies(): string[] {
    return ['vue', 'vue-router'];
  }
};

// ============================================
// Export all Vue templates
// ============================================

export const vueTemplates = {
  composition: vueCompositionComponent,
  options: vueOptionsComponent,
  composable: vueComposable,
  store: vuePiniaStore,
  router: vueRouter
};

export default vueTemplates;
