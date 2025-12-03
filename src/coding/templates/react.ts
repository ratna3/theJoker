/**
 * The Joker - Agentic Terminal
 * React Framework Templates
 */

import { Template, TemplateOptions, TemplateResult } from './types';

// ============================================
// Template Options
// ============================================

export interface ReactComponentOptions extends TemplateOptions {
  componentName: string;
  props?: PropDefinition[];
  state?: StateDefinition[];
  hooks?: string[];
  styling?: 'css' | 'scss' | 'styled-components' | 'tailwind' | 'css-modules';
  withMemo?: boolean;
  withForwardRef?: boolean;
}

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface StateDefinition {
  name: string;
  type: string;
  initialValue: string;
  setterName?: string;
}

// ============================================
// React Functional Component Template
// ============================================

export const reactFunctionalComponent: Template<ReactComponentOptions> = {
  name: 'react-functional',
  description: 'React functional component with TypeScript',
  framework: 'react',
  language: 'typescript',
  
  generate(options: ReactComponentOptions): TemplateResult {
    const {
      componentName,
      props = [],
      state = [],
      hooks = [],
      styling = 'css',
      withMemo = false,
      withForwardRef = false,
      typescript = true
    } = options;

    const imports: string[] = ['import React'];
    const reactImports: string[] = [];

    // Determine React imports needed
    if (state.length > 0) reactImports.push('useState');
    if (hooks.includes('useEffect')) reactImports.push('useEffect');
    if (hooks.includes('useCallback')) reactImports.push('useCallback');
    if (hooks.includes('useMemo')) reactImports.push('useMemo');
    if (hooks.includes('useRef')) reactImports.push('useRef');
    if (hooks.includes('useContext')) reactImports.push('useContext');
    if (withMemo) reactImports.push('memo');
    if (withForwardRef) reactImports.push('forwardRef');

    // Build import statement
    if (reactImports.length > 0) {
      imports[0] = `import React, { ${reactImports.join(', ')} } from 'react'`;
    } else {
      imports[0] = "import React from 'react'";
    }

    // Add styling imports
    if (styling === 'styled-components') {
      imports.push("import styled from 'styled-components'");
    } else if (styling === 'css-modules') {
      imports.push(`import styles from './${componentName}.module.css'`);
    } else if (styling === 'css' || styling === 'scss') {
      imports.push(`import './${componentName}.${styling}'`);
    }

    // Generate props interface
    let propsInterface = '';
    if (typescript && props.length > 0) {
      const propsLines = props.map(p => {
        const optional = p.required ? '' : '?';
        const comment = p.description ? `  /** ${p.description} */\n` : '';
        return `${comment}  ${p.name}${optional}: ${p.type};`;
      });
      propsInterface = `\ninterface ${componentName}Props {\n${propsLines.join('\n')}\n}\n`;
    }

    // Generate state declarations
    const stateDeclarations = state.map(s => {
      const setter = s.setterName || `set${s.name.charAt(0).toUpperCase()}${s.name.slice(1)}`;
      return `  const [${s.name}, ${setter}] = useState<${s.type}>(${s.initialValue});`;
    });

    // Generate component body
    const propsArg = props.length > 0
      ? typescript 
        ? `{ ${props.map(p => p.name).join(', ')} }: ${componentName}Props`
        : `{ ${props.map(p => p.name).join(', ')} }`
      : '';

    let componentBody = `
const ${componentName}${typescript ? `: React.FC<${componentName}Props>` : ''} = (${propsArg}) => {
${stateDeclarations.length > 0 ? stateDeclarations.join('\n') + '\n' : ''}
  return (
    <div className="${styling === 'css-modules' ? `{styles.container}` : `${componentName.toLowerCase()}-container`}">
      <h1>${componentName}</h1>
      {/* Component content */}
    </div>
  );
};`;

    // Wrap with memo if needed
    if (withMemo) {
      componentBody = `\nconst ${componentName}Base${typescript ? `: React.FC<${componentName}Props>` : ''} = (${propsArg}) => {
${stateDeclarations.length > 0 ? stateDeclarations.join('\n') + '\n' : ''}
  return (
    <div className="${styling === 'css-modules' ? `{styles.container}` : `${componentName.toLowerCase()}-container`}">
      <h1>${componentName}</h1>
      {/* Component content */}
    </div>
  );
};

const ${componentName} = memo(${componentName}Base);`;
    }

    // Build final code
    const code = `${imports.join('\n')}
${propsInterface}${componentBody}

export default ${componentName};
`;

    return {
      code,
      fileName: `${componentName}.tsx`,
      language: 'typescript',
      dependencies: this.getDependencies(options)
    };
  },

  getDependencies(options: ReactComponentOptions): string[] {
    const deps = ['react'];
    if (options.styling === 'styled-components') deps.push('styled-components');
    return deps;
  }
};

// ============================================
// React Component with State Template
// ============================================

export const reactComponentWithState: Template<ReactComponentOptions> = {
  name: 'react-stateful',
  description: 'React component with state management',
  framework: 'react',
  language: 'typescript',

  generate(options: ReactComponentOptions): TemplateResult {
    const { componentName, props = [], state = [], typescript = true } = options;

    // Ensure we have some default state
    const stateToUse = state.length > 0 ? state : [
      { name: 'loading', type: 'boolean', initialValue: 'false' },
      { name: 'data', type: 'any', initialValue: 'null' },
      { name: 'error', type: 'Error | null', initialValue: 'null' }
    ];

    const propsInterface = typescript && props.length > 0
      ? `interface ${componentName}Props {\n${props.map(p => `  ${p.name}${p.required ? '' : '?'}: ${p.type};`).join('\n')}\n}\n\n`
      : '';

    const stateHooks = stateToUse.map(s => {
      const setter = s.setterName || `set${s.name.charAt(0).toUpperCase()}${s.name.slice(1)}`;
      return `  const [${s.name}, ${setter}] = useState<${s.type}>(${s.initialValue});`;
    }).join('\n');

    const propsArg = props.length > 0
      ? typescript
        ? `{ ${props.map(p => p.name).join(', ')} }: ${componentName}Props`
        : `{ ${props.map(p => p.name).join(', ')} }`
      : '';

    const code = `import React, { useState, useEffect, useCallback } from 'react';

${propsInterface}const ${componentName}${typescript ? `: React.FC<${componentName}Props>` : ''} = (${propsArg}) => {
${stateHooks}

  useEffect(() => {
    // Initial data fetch or side effect
    const fetchData = async () => {
      setLoading(true);
      try {
        // Add your data fetching logic here
        setData(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAction = useCallback(() => {
    // Handle user action
  }, []);

  if (loading) {
    return <div className="${componentName.toLowerCase()}-loading">Loading...</div>;
  }

  if (error) {
    return <div className="${componentName.toLowerCase()}-error">Error: {error.message}</div>;
  }

  return (
    <div className="${componentName.toLowerCase()}-container">
      <h1>${componentName}</h1>
      {/* Render data */}
      <button onClick={handleAction}>Action</button>
    </div>
  );
};

export default ${componentName};
`;

    return {
      code,
      fileName: `${componentName}.tsx`,
      language: 'typescript',
      dependencies: ['react']
    };
  },

  getDependencies(): string[] {
    return ['react'];
  }
};

// ============================================
// React Custom Hook Template
// ============================================

export interface ReactHookOptions extends TemplateOptions {
  hookName: string;
  parameters?: { name: string; type: string }[];
  returnType?: string;
  withCleanup?: boolean;
}

export const reactCustomHook: Template<ReactHookOptions> = {
  name: 'react-hook',
  description: 'React custom hook',
  framework: 'react',
  language: 'typescript',

  generate(options: ReactHookOptions): TemplateResult {
    const {
      hookName,
      parameters = [],
      returnType = 'void',
      withCleanup = false,
      typescript = true
    } = options;

    const params = parameters.map(p => 
      typescript ? `${p.name}: ${p.type}` : p.name
    ).join(', ');

    const cleanupCode = withCleanup ? `
    return () => {
      // Cleanup logic
    };` : '';

    const code = `import { useState, useEffect, useCallback } from 'react';

/**
 * ${hookName} - Custom React hook
 * ${parameters.length > 0 ? '\n * @param ' + parameters.map(p => `${p.name} - ${p.type}`).join('\n * @param ') : ''}
 * @returns ${returnType}
 */
export function ${hookName}(${params})${typescript ? `: ${returnType}` : ''} {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Effect logic
    setLoading(true);
    
    try {
      // Perform operation
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
${cleanupCode}
  }, [${parameters.map(p => p.name).join(', ')}]);

  const reset = useCallback(() => {
    setState(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    state,
    loading,
    error,
    reset
  };
}

export default ${hookName};
`;

    return {
      code,
      fileName: `${hookName}.ts`,
      language: 'typescript',
      dependencies: ['react']
    };
  },

  getDependencies(): string[] {
    return ['react'];
  }
};

// ============================================
// React Context Template
// ============================================

export interface ReactContextOptions extends TemplateOptions {
  contextName: string;
  stateShape?: { name: string; type: string; defaultValue: string }[];
  actions?: { name: string; params?: string; description?: string }[];
}

export const reactContext: Template<ReactContextOptions> = {
  name: 'react-context',
  description: 'React Context with Provider',
  framework: 'react',
  language: 'typescript',

  generate(options: ReactContextOptions): TemplateResult {
    const {
      contextName,
      stateShape = [{ name: 'value', type: 'string', defaultValue: "''" }],
      actions = [{ name: 'setValue', params: 'value: string' }],
      typescript = true
    } = options;

    const stateType = typescript
      ? `interface ${contextName}State {\n${stateShape.map(s => `  ${s.name}: ${s.type};`).join('\n')}\n}`
      : '';

    const actionsType = typescript
      ? `interface ${contextName}Actions {\n${actions.map(a => `  ${a.name}: (${a.params || ''}) => void;`).join('\n')}\n}`
      : '';

    const contextType = typescript
      ? `type ${contextName}ContextType = ${contextName}State & ${contextName}Actions;`
      : '';

    const defaultState = stateShape.map(s => `  ${s.name}: ${s.defaultValue}`).join(',\n');

    const code = `import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';

${stateType}

${actionsType}

${contextType}

const ${contextName}Context = createContext<${contextName}ContextType | undefined>(undefined);

interface ${contextName}ProviderProps {
  children: ReactNode;
}

export function ${contextName}Provider({ children }: ${contextName}ProviderProps) {
  const [state, setState] = useState<${contextName}State>({
${defaultState}
  });

${actions.map(a => `  const ${a.name} = useCallback((${a.params || ''}) => {
    // Implement ${a.name}
    setState(prev => ({ ...prev }));
  }, []);`).join('\n\n')}

  const value = useMemo(() => ({
    ...state,
${actions.map(a => `    ${a.name}`).join(',\n')}
  }), [state, ${actions.map(a => a.name).join(', ')}]);

  return (
    <${contextName}Context.Provider value={value}>
      {children}
    </${contextName}Context.Provider>
  );
}

export function use${contextName}() {
  const context = useContext(${contextName}Context);
  if (context === undefined) {
    throw new Error('use${contextName} must be used within a ${contextName}Provider');
  }
  return context;
}

export default ${contextName}Context;
`;

    return {
      code,
      fileName: `${contextName}Context.tsx`,
      language: 'typescript',
      dependencies: ['react']
    };
  },

  getDependencies(): string[] {
    return ['react'];
  }
};

// ============================================
// Export all React templates
// ============================================

export const reactTemplates = {
  functional: reactFunctionalComponent,
  stateful: reactComponentWithState,
  hook: reactCustomHook,
  context: reactContext
};

export default reactTemplates;
