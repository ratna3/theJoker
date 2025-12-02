/**
 * Code Tools - Agentic coding capabilities for React/Next.js
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { Tool, ToolCategory, toolRegistry } from './registry';

interface CodeGenerationParams {
  type: 'component' | 'page' | 'api' | 'hook' | 'utility' | 'context' | 'service';
  name: string;
  description?: string;
  props?: Array<{ name: string; type: string; required?: boolean }>;
  typescript?: boolean;
  outputPath?: string;
}

interface CodeModificationParams {
  filePath: string;
  operation: 'add' | 'remove' | 'update' | 'replace';
  target?: string;
  content?: string;
  position?: 'before' | 'after' | 'replace';
}

interface ProjectScaffoldParams {
  name: string;
  template: 'nextjs' | 'react' | 'react-vite';
  features?: string[];
  typescript?: boolean;
  outputPath?: string;
}

interface DependencyParams {
  action: 'add' | 'remove' | 'update' | 'list';
  packages?: string[];
  dev?: boolean;
  workingDir?: string;
}

interface CodeAnalysisParams {
  filePath: string;
  analysisType: 'structure' | 'imports' | 'exports' | 'dependencies' | 'complexity';
}

// Code templates
const COMPONENT_TEMPLATE = (name: string, props: any[], typescript: boolean) => {
  const propsInterface = typescript && props.length > 0 
    ? `interface ${name}Props {\n${props.map(p => `  ${p.name}${p.required ? '' : '?'}: ${p.type};`).join('\n')}\n}\n\n`
    : '';
  
  const propsArg = typescript && props.length > 0 ? `{ ${props.map(p => p.name).join(', ')} }: ${name}Props` : 'props';
  const ext = typescript ? 'tsx' : 'jsx';
  
  return {
    content: `${propsInterface}export default function ${name}(${propsArg}) {
  return (
    <div className="${name.toLowerCase()}">
      <h1>${name}</h1>
      {/* Add your component content here */}
    </div>
  );
}
`,
    extension: ext
  };
};

const HOOK_TEMPLATE = (name: string, typescript: boolean) => {
  const ext = typescript ? 'ts' : 'js';
  return {
    content: `import { useState, useEffect } from 'react';

export function ${name}() {
  const [state, setState] = useState${typescript ? '<unknown>' : ''}(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState${typescript ? '<Error | null>' : ''}(null);

  useEffect(() => {
    // Add your effect logic here
  }, []);

  return { state, loading, error };
}
`,
    extension: ext
  };
};

const API_ROUTE_TEMPLATE = (name: string, typescript: boolean) => {
  const ext = typescript ? 'ts' : 'js';
  return {
    content: `import type { NextApiRequest, NextApiResponse } from 'next';

${typescript ? `type ResponseData = {
  message: string;
  data?: unknown;
  error?: string;
};

` : ''}export default async function handler(
  req${typescript ? ': NextApiRequest' : ''},
  res${typescript ? ': NextApiResponse<ResponseData>' : ''}
) {
  if (req.method === 'GET') {
    try {
      // Add your GET logic here
      res.status(200).json({ message: 'Success' });
    } catch (error) {
      res.status(500).json({ message: 'Error', error: String(error) });
    }
  } else if (req.method === 'POST') {
    try {
      const data = req.body;
      // Add your POST logic here
      res.status(201).json({ message: 'Created', data });
    } catch (error) {
      res.status(500).json({ message: 'Error', error: String(error) });
    }
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(\`Method \${req.method} Not Allowed\`);
  }
}
`,
    extension: ext
  };
};

const PAGE_TEMPLATE = (name: string, typescript: boolean) => {
  const ext = typescript ? 'tsx' : 'jsx';
  return {
    content: `import Head from 'next/head';

export default function ${name}Page() {
  return (
    <>
      <Head>
        <title>${name}</title>
        <meta name="description" content="${name} page" />
      </Head>
      <main className="${name.toLowerCase()}-page">
        <h1>${name}</h1>
        {/* Add your page content here */}
      </main>
    </>
  );
}
`,
    extension: ext
  };
};

const CONTEXT_TEMPLATE = (name: string, typescript: boolean) => {
  const ext = typescript ? 'tsx' : 'jsx';
  return {
    content: `import { createContext, useContext, useState, ReactNode } from 'react';

${typescript ? `interface ${name}ContextType {
  value: unknown;
  setValue: (value: unknown) => void;
}

interface ${name}ProviderProps {
  children: ReactNode;
}

` : ''}const ${name}Context = createContext${typescript ? `<${name}ContextType | undefined>` : ''}(undefined);

export function ${name}Provider({ children }${typescript ? `: ${name}ProviderProps` : ''}) {
  const [value, setValue] = useState${typescript ? '<unknown>' : ''}(null);

  return (
    <${name}Context.Provider value={{ value, setValue }}>
      {children}
    </${name}Context.Provider>
  );
}

export function use${name}() {
  const context = useContext(${name}Context);
  if (context === undefined) {
    throw new Error('use${name} must be used within a ${name}Provider');
  }
  return context;
}
`,
    extension: ext
  };
};

const SERVICE_TEMPLATE = (name: string, typescript: boolean) => {
  const ext = typescript ? 'ts' : 'js';
  return {
    content: `${typescript ? `interface ${name}Response {
  success: boolean;
  data?: unknown;
  error?: string;
}

` : ''}const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export const ${name}Service = {
  async getAll()${typescript ? ': Promise<' + name + 'Response>' : ''} {
    try {
      const response = await fetch(\`\${BASE_URL}/${name.toLowerCase()}\`);
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  async getById(id${typescript ? ': string' : ''})${typescript ? ': Promise<' + name + 'Response>' : ''} {
    try {
      const response = await fetch(\`\${BASE_URL}/${name.toLowerCase()}/\${id}\`);
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  async create(payload${typescript ? ': unknown' : ''})${typescript ? ': Promise<' + name + 'Response>' : ''} {
    try {
      const response = await fetch(\`\${BASE_URL}/${name.toLowerCase()}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  async update(id${typescript ? ': string' : ''}, payload${typescript ? ': unknown' : ''})${typescript ? ': Promise<' + name + 'Response>' : ''} {
    try {
      const response = await fetch(\`\${BASE_URL}/${name.toLowerCase()}/\${id}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

  async delete(id${typescript ? ': string' : ''})${typescript ? ': Promise<' + name + 'Response>' : ''} {
    try {
      const response = await fetch(\`\${BASE_URL}/${name.toLowerCase()}/\${id}\`, {
        method: 'DELETE',
      });
      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },
};
`,
    extension: ext
  };
};

const UTILITY_TEMPLATE = (name: string, typescript: boolean) => {
  const ext = typescript ? 'ts' : 'js';
  return {
    content: `/**
 * ${name} Utility Functions
 */

export function ${name.toLowerCase()}Helper(input${typescript ? ': unknown' : ''})${typescript ? ': unknown' : ''} {
  // Add your utility logic here
  return input;
}

export function format${name}(value${typescript ? ': unknown' : ''})${typescript ? ': string' : ''} {
  return String(value);
}

export function validate${name}(value${typescript ? ': unknown' : ''})${typescript ? ': boolean' : ''} {
  return value !== null && value !== undefined;
}

export default {
  ${name.toLowerCase()}Helper,
  format${name},
  validate${name},
};
`,
    extension: ext
  };
};

// Generate code based on type
async function generateCode(params: CodeGenerationParams): Promise<{ success: boolean; filePath?: string; content?: string; error?: string }> {
  try {
    const { type, name, props = [], typescript = true, outputPath } = params;
    
    let template: { content: string; extension: string };
    
    switch (type) {
      case 'component':
        template = COMPONENT_TEMPLATE(name, props, typescript);
        break;
      case 'hook':
        template = HOOK_TEMPLATE(name, typescript);
        break;
      case 'api':
        template = API_ROUTE_TEMPLATE(name, typescript);
        break;
      case 'page':
        template = PAGE_TEMPLATE(name, typescript);
        break;
      case 'context':
        template = CONTEXT_TEMPLATE(name, typescript);
        break;
      case 'service':
        template = SERVICE_TEMPLATE(name, typescript);
        break;
      case 'utility':
        template = UTILITY_TEMPLATE(name, typescript);
        break;
      default:
        return { success: false, error: `Unknown type: ${type}` };
    }
    
    if (outputPath) {
      const fullPath = path.join(outputPath, `${name}.${template.extension}`);
      const dir = path.dirname(fullPath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, template.content, 'utf-8');
      logger.info(`Generated ${type}: ${fullPath}`);
      
      return { success: true, filePath: fullPath, content: template.content };
    }
    
    return { success: true, content: template.content };
  } catch (error) {
    logger.error('Code generation failed:', error);
    return { success: false, error: String(error) };
  }
}

// Modify existing code
async function modifyCode(params: CodeModificationParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { filePath, operation, target, content, position = 'after' } = params;
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }
    
    let fileContent = fs.readFileSync(filePath, 'utf-8');
    
    switch (operation) {
      case 'add':
        if (position === 'before' && target) {
          fileContent = fileContent.replace(target, `${content}\n${target}`);
        } else if (position === 'after' && target) {
          fileContent = fileContent.replace(target, `${target}\n${content}`);
        } else {
          fileContent += `\n${content}`;
        }
        break;
        
      case 'remove':
        if (target) {
          fileContent = fileContent.replace(new RegExp(target, 'g'), '');
        }
        break;
        
      case 'update':
      case 'replace':
        if (target && content) {
          fileContent = fileContent.replace(target, content);
        }
        break;
        
      default:
        return { success: false, error: `Unknown operation: ${operation}` };
    }
    
    fs.writeFileSync(filePath, fileContent, 'utf-8');
    logger.info(`Modified file: ${filePath}`);
    
    return { success: true };
  } catch (error) {
    logger.error('Code modification failed:', error);
    return { success: false, error: String(error) };
  }
}

// Scaffold a new project
async function scaffoldProject(params: ProjectScaffoldParams): Promise<{ success: boolean; projectPath?: string; error?: string }> {
  try {
    const { name, template, features = [], typescript = true, outputPath = process.cwd() } = params;
    
    const projectPath = path.join(outputPath, name);
    
    if (fs.existsSync(projectPath)) {
      return { success: false, error: `Directory already exists: ${projectPath}` };
    }
    
    fs.mkdirSync(projectPath, { recursive: true });
    
    // Create basic structure
    const directories = [
      'src/components',
      'src/pages',
      'src/styles',
      'src/hooks',
      'src/utils',
      'src/services',
      'src/context',
      'public',
    ];
    
    if (template === 'nextjs') {
      directories.push('src/pages/api');
    }
    
    for (const dir of directories) {
      fs.mkdirSync(path.join(projectPath, dir), { recursive: true });
    }
    
    // Create package.json
    const packageJson = {
      name,
      version: '0.1.0',
      private: true,
      scripts: {
        dev: template === 'react-vite' ? 'vite' : 'next dev',
        build: template === 'react-vite' ? 'vite build' : 'next build',
        start: template === 'react-vite' ? 'vite preview' : 'next start',
        lint: 'eslint .',
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
        ...(template === 'nextjs' ? { next: '^14.0.0' } : {}),
      },
      devDependencies: {
        ...(typescript ? {
          typescript: '^5.0.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          ...(template === 'nextjs' ? { '@types/node': '^20.0.0' } : {}),
        } : {}),
        eslint: '^8.0.0',
        ...(template === 'react-vite' ? { vite: '^5.0.0', '@vitejs/plugin-react': '^4.0.0' } : {}),
      },
    };
    
    fs.writeFileSync(
      path.join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2),
      'utf-8'
    );
    
    // Create tsconfig if TypeScript
    if (typescript) {
      const tsconfig = {
        compilerOptions: {
          target: 'ES2020',
          lib: ['dom', 'dom.iterable', 'ES2020'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          paths: {
            '@/*': ['./src/*'],
          },
        },
        include: ['src/**/*'],
        exclude: ['node_modules'],
      };
      
      fs.writeFileSync(
        path.join(projectPath, 'tsconfig.json'),
        JSON.stringify(tsconfig, null, 2),
        'utf-8'
      );
    }
    
    // Create README
    fs.writeFileSync(
      path.join(projectPath, 'README.md'),
      `# ${name}\n\nGenerated by The Joker 🃏\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
      'utf-8'
    );
    
    logger.info(`Scaffolded project: ${projectPath}`);
    
    return { success: true, projectPath };
  } catch (error) {
    logger.error('Project scaffolding failed:', error);
    return { success: false, error: String(error) };
  }
}

// Analyze code structure
async function analyzeCode(params: CodeAnalysisParams): Promise<{ success: boolean; analysis?: any; error?: string }> {
  try {
    const { filePath, analysisType } = params;
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    const analysis: any = {
      filePath,
      lineCount: lines.length,
      size: content.length,
    };
    
    switch (analysisType) {
      case 'structure':
        // Basic structure analysis
        analysis.functions = (content.match(/function\s+\w+/g) || []).length;
        analysis.classes = (content.match(/class\s+\w+/g) || []).length;
        analysis.interfaces = (content.match(/interface\s+\w+/g) || []).length;
        analysis.types = (content.match(/type\s+\w+/g) || []).length;
        analysis.exports = (content.match(/export\s+(default\s+)?/g) || []).length;
        break;
        
      case 'imports':
        const importMatches = content.match(/import\s+.*?from\s+['"]([^'"]+)['"]/g) || [];
        analysis.imports = importMatches.map(m => {
          const match = m.match(/from\s+['"]([^'"]+)['"]/);
          return match ? match[1] : m;
        });
        analysis.importCount = analysis.imports.length;
        break;
        
      case 'exports':
        const exportMatches = content.match(/export\s+(default\s+)?(const|function|class|interface|type|let|var)?\s*(\w+)/g) || [];
        analysis.exports = exportMatches;
        analysis.exportCount = exportMatches.length;
        break;
        
      case 'dependencies':
        // Check for package.json imports
        const pkgImports = content.match(/from\s+['"]([^./][^'"]+)['"]/g) || [];
        analysis.dependencies = pkgImports.map(m => {
          const match = m.match(/['"]([^'"]+)['"]/);
          return match ? match[1].split('/')[0] : null;
        }).filter((v, i, a) => v && a.indexOf(v) === i);
        break;
        
      case 'complexity':
        // Simple complexity metrics
        analysis.conditionals = (content.match(/if\s*\(|switch\s*\(|\?\s*:/g) || []).length;
        analysis.loops = (content.match(/for\s*\(|while\s*\(|\.forEach|\.map|\.filter|\.reduce/g) || []).length;
        analysis.tryCatch = (content.match(/try\s*\{/g) || []).length;
        analysis.awaitCount = (content.match(/await\s+/g) || []).length;
        analysis.callbackDepth = Math.max(...lines.map(l => (l.match(/\(/g) || []).length));
        break;
        
      default:
        return { success: false, error: `Unknown analysis type: ${analysisType}` };
    }
    
    return { success: true, analysis };
  } catch (error) {
    logger.error('Code analysis failed:', error);
    return { success: false, error: String(error) };
  }
}

// Tool definitions
const generateCodeTool: Tool = {
  name: 'generate_code',
  description: 'Generate React/Next.js code (components, hooks, pages, API routes, contexts, services, utilities)',
  category: ToolCategory.CODE,
  parameters: [
    {
      name: 'type',
      type: 'string',
      description: 'Type of code to generate: component, page, api, hook, utility, context, service',
      required: true,
    },
    {
      name: 'name',
      type: 'string',
      description: 'Name of the code element (e.g., Button, useAuth, UserService)',
      required: true,
    },
    {
      name: 'props',
      type: 'array',
      description: 'Array of props for components: [{ name, type, required }]',
      required: false,
    },
    {
      name: 'typescript',
      type: 'boolean',
      description: 'Generate TypeScript code (default: true)',
      required: false,
    },
    {
      name: 'outputPath',
      type: 'string',
      description: 'Output directory path (optional, returns content if not provided)',
      required: false,
    },
  ],
  execute: async (params) => generateCode(params as CodeGenerationParams),
};

const modifyCodeTool: Tool = {
  name: 'modify_code',
  description: 'Modify existing code files (add, remove, update, replace content)',
  category: ToolCategory.CODE,
  parameters: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Path to the file to modify',
      required: true,
    },
    {
      name: 'operation',
      type: 'string',
      description: 'Operation: add, remove, update, replace',
      required: true,
    },
    {
      name: 'target',
      type: 'string',
      description: 'Target string or pattern to find',
      required: false,
    },
    {
      name: 'content',
      type: 'string',
      description: 'New content to add or use as replacement',
      required: false,
    },
    {
      name: 'position',
      type: 'string',
      description: 'Position for add operation: before, after, replace',
      required: false,
    },
  ],
  execute: async (params) => modifyCode(params as CodeModificationParams),
};

const scaffoldProjectTool: Tool = {
  name: 'scaffold_project',
  description: 'Create a new React/Next.js project with basic structure',
  category: ToolCategory.CODE,
  parameters: [
    {
      name: 'name',
      type: 'string',
      description: 'Project name',
      required: true,
    },
    {
      name: 'template',
      type: 'string',
      description: 'Template: nextjs, react, react-vite',
      required: true,
    },
    {
      name: 'features',
      type: 'array',
      description: 'Additional features to include',
      required: false,
    },
    {
      name: 'typescript',
      type: 'boolean',
      description: 'Use TypeScript (default: true)',
      required: false,
    },
    {
      name: 'outputPath',
      type: 'string',
      description: 'Parent directory for the project',
      required: false,
    },
  ],
  execute: async (params) => scaffoldProject(params as ProjectScaffoldParams),
};

const analyzeCodeTool: Tool = {
  name: 'analyze_code',
  description: 'Analyze code structure, imports, exports, dependencies, or complexity',
  category: ToolCategory.CODE,
  parameters: [
    {
      name: 'filePath',
      type: 'string',
      description: 'Path to the file to analyze',
      required: true,
    },
    {
      name: 'analysisType',
      type: 'string',
      description: 'Type of analysis: structure, imports, exports, dependencies, complexity',
      required: true,
    },
  ],
  execute: async (params) => analyzeCode(params as CodeAnalysisParams),
};

// Register all code tools
export function registerCodeTools(): void {
  toolRegistry.register(generateCodeTool);
  toolRegistry.register(modifyCodeTool);
  toolRegistry.register(scaffoldProjectTool);
  toolRegistry.register(analyzeCodeTool);
  
  logger.info('Code tools registered');
}

export {
  generateCode,
  modifyCode,
  scaffoldProject,
  analyzeCode,
  generateCodeTool,
  modifyCodeTool,
  scaffoldProjectTool,
  analyzeCodeTool,
};
