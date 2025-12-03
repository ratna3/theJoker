/**
 * The Joker - Agentic Terminal
 * Express/Node.js Framework Templates
 */

import { Template, TemplateOptions, TemplateResult, EndpointDefinition, MethodDefinition } from './types';

// ============================================
// Express/Node.js Specific Options
// ============================================

export interface ExpressAppOptions extends TemplateOptions {
  appName?: string;
  port?: number;
  middleware?: string[];
  cors?: boolean;
  helmet?: boolean;
  morgan?: boolean;
  errorHandling?: boolean;
}

export interface ExpressRouterOptions extends TemplateOptions {
  routerName: string;
  basePath?: string;
  endpoints: EndpointDefinition[];
  middleware?: string[];
  withValidation?: boolean;
}

export interface ExpressControllerOptions extends TemplateOptions {
  controllerName: string;
  resourceName: string;
  methods: ('index' | 'show' | 'create' | 'update' | 'delete')[];
  withService?: boolean;
}

export interface ExpressMiddlewareOptions extends TemplateOptions {
  middlewareName: string;
  type?: 'auth' | 'validation' | 'logging' | 'error' | 'custom';
  async?: boolean;
}

export interface ExpressServiceOptions extends TemplateOptions {
  serviceName: string;
  methods?: MethodDefinition[];
  withRepository?: boolean;
}

// ============================================
// Express App Template
// ============================================

export const expressApp: Template<ExpressAppOptions> = {
  name: 'express-app',
  description: 'Express.js application entry point',
  framework: 'express',
  language: 'typescript',

  generate(options: ExpressAppOptions): TemplateResult {
    const {
      appName = 'app',
      port = 3000,
      cors = true,
      helmet = true,
      morgan = true,
      errorHandling = true,
      typescript = true
    } = options;

    const imports: string[] = [
      "import express, { Express, Request, Response, NextFunction } from 'express';"
    ];

    if (cors) imports.push("import cors from 'cors';");
    if (helmet) imports.push("import helmet from 'helmet';");
    if (morgan) imports.push("import morgan from 'morgan';");

    const middleware: string[] = [];
    middleware.push('app.use(express.json());');
    middleware.push('app.use(express.urlencoded({ extended: true }));');
    if (cors) middleware.push('app.use(cors());');
    if (helmet) middleware.push('app.use(helmet());');
    if (morgan) middleware.push("app.use(morgan('dev'));");

    const errorHandler = errorHandling ? `
// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found' });
});` : '';

    const code = `${imports.join('\n')}

const app: Express = express();
const PORT = process.env.PORT || ${port};

// Middleware
${middleware.join('\n')}

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
// app.use('/api/users', usersRouter);
// app.use('/api/posts', postsRouter);
${errorHandler}

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(\`🚀 Server running on port \${PORT}\`);
    console.log(\`📍 Health check: http://localhost:\${PORT}/health\`);
  });
}

export default app;
`;

    return {
      code,
      fileName: `${appName}.ts`,
      language: 'typescript',
      dependencies: this.getDependencies(options)
    };
  },

  getDependencies(options: ExpressAppOptions): string[] {
    const deps = ['express'];
    if (options.cors) deps.push('cors');
    if (options.helmet) deps.push('helmet');
    if (options.morgan) deps.push('morgan');
    deps.push('@types/express', '@types/cors', '@types/morgan');
    return deps;
  }
};

// ============================================
// Express Router Template
// ============================================

export const expressRouter: Template<ExpressRouterOptions> = {
  name: 'express-router',
  description: 'Express.js router with endpoints',
  framework: 'express',
  language: 'typescript',

  generate(options: ExpressRouterOptions): TemplateResult {
    const {
      routerName,
      basePath = `/${routerName.toLowerCase()}`,
      endpoints,
      middleware = [],
      withValidation = false,
      typescript = true
    } = options;

    const imports = [
      "import { Router, Request, Response, NextFunction } from 'express';"
    ];

    if (withValidation) {
      imports.push("import { body, param, validationResult } from 'express-validator';");
    }

    const middlewareImports = middleware.map(m => 
      `import { ${m} } from '../middleware/${m}';`
    );

    const routeHandlers = endpoints.map(endpoint => {
      const handlerName = `${endpoint.method.toLowerCase()}${routerName}${endpoint.path === '/' ? '' : endpoint.path.replace(/\//g, '_').replace(/:/g, '')}`;
      
      let validationMiddleware = '';
      if (withValidation && (endpoint.method === 'POST' || endpoint.method === 'PUT')) {
        validationMiddleware = `
  [
    body('name').optional().isString(),
    // Add validation rules
  ],`;
      }

      return `
// ${endpoint.method} ${basePath}${endpoint.path}
${endpoint.description ? `// ${endpoint.description}` : ''}
router.${endpoint.method.toLowerCase()}('${endpoint.path}',${validationMiddleware} async (req: Request, res: Response, next: NextFunction) => {
  try {
    ${withValidation ? `const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    ` : ''}${endpoint.method === 'GET' ? `res.json({ message: '${endpoint.description || `Get ${routerName}`}', data: [] });` : ''}${endpoint.method === 'POST' ? `const data = req.body;
    res.status(201).json({ message: 'Created', data });` : ''}${endpoint.method === 'PUT' || endpoint.method === 'PATCH' ? `const { id } = req.params;
    const data = req.body;
    res.json({ message: 'Updated', id, data });` : ''}${endpoint.method === 'DELETE' ? `const { id } = req.params;
    res.json({ message: 'Deleted', id });` : ''}
  } catch (error) {
    next(error);
  }
});`;
    }).join('\n');

    const code = `${imports.join('\n')}
${middlewareImports.length > 0 ? middlewareImports.join('\n') + '\n' : ''}
const router = Router();

// Apply middleware
${middleware.map(m => `router.use(${m});`).join('\n') || '// No global middleware'}
${routeHandlers}

export default router;
`;

    return {
      code,
      fileName: `${routerName.toLowerCase()}.routes.ts`,
      language: 'typescript',
      dependencies: this.getDependencies(options)
    };
  },

  getDependencies(options: ExpressRouterOptions): string[] {
    const deps = ['express'];
    if (options.withValidation) deps.push('express-validator');
    return deps;
  }
};

// ============================================
// Express Controller Template
// ============================================

export const expressController: Template<ExpressControllerOptions> = {
  name: 'express-controller',
  description: 'Express.js controller class',
  framework: 'express',
  language: 'typescript',

  generate(options: ExpressControllerOptions): TemplateResult {
    const {
      controllerName,
      resourceName,
      methods = ['index', 'show', 'create', 'update', 'delete'],
      withService = true,
      typescript = true
    } = options;

    const serviceName = `${resourceName}Service`;
    const serviceImport = withService 
      ? `import { ${serviceName} } from '../services/${resourceName.toLowerCase()}.service';\n`
      : '';

    const methodImplementations = methods.map(method => {
      switch (method) {
        case 'index':
          return `  /**
   * Get all ${resourceName}s
   */
  async index(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = ${withService ? `await this.${resourceName.toLowerCase()}Service.findAll()` : '[]'};
      res.json({ data: items, count: items.length });
    } catch (error) {
      next(error);
    }
  }`;
        case 'show':
          return `  /**
   * Get ${resourceName} by ID
   */
  async show(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const item = ${withService ? `await this.${resourceName.toLowerCase()}Service.findById(id)` : 'null'};
      if (!item) {
        res.status(404).json({ error: '${resourceName} not found' });
        return;
      }
      res.json({ data: item });
    } catch (error) {
      next(error);
    }
  }`;
        case 'create':
          return `  /**
   * Create new ${resourceName}
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body;
      const item = ${withService ? `await this.${resourceName.toLowerCase()}Service.create(data)` : 'data'};
      res.status(201).json({ data: item });
    } catch (error) {
      next(error);
    }
  }`;
        case 'update':
          return `  /**
   * Update ${resourceName}
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body;
      const item = ${withService ? `await this.${resourceName.toLowerCase()}Service.update(id, data)` : '{ id, ...data }'};
      if (!item) {
        res.status(404).json({ error: '${resourceName} not found' });
        return;
      }
      res.json({ data: item });
    } catch (error) {
      next(error);
    }
  }`;
        case 'delete':
          return `  /**
   * Delete ${resourceName}
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      ${withService ? `await this.${resourceName.toLowerCase()}Service.delete(id)` : ''};
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }`;
        default:
          return '';
      }
    }).join('\n\n');

    const constructorCode = withService
      ? `  private ${resourceName.toLowerCase()}Service: ${serviceName};

  constructor() {
    this.${resourceName.toLowerCase()}Service = new ${serviceName}();
  }
`
      : '';

    const code = `import { Request, Response, NextFunction } from 'express';
${serviceImport}
/**
 * ${controllerName}
 * Handles HTTP requests for ${resourceName} resources
 */
export class ${controllerName} {
${constructorCode}
${methodImplementations}
}

export default new ${controllerName}();
`;

    return {
      code,
      fileName: `${resourceName.toLowerCase()}.controller.ts`,
      language: 'typescript',
      dependencies: ['express']
    };
  },

  getDependencies(): string[] {
    return ['express'];
  }
};

// ============================================
// Express Middleware Template
// ============================================

export const expressMiddleware: Template<ExpressMiddlewareOptions> = {
  name: 'express-middleware',
  description: 'Express.js middleware function',
  framework: 'express',
  language: 'typescript',

  generate(options: ExpressMiddlewareOptions): TemplateResult {
    const {
      middlewareName,
      type = 'custom',
      async: isAsync = true
    } = options;

    let implementation = '';
    
    switch (type) {
      case 'auth':
        implementation = `  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify token (implement your verification logic)
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }`;
        break;
        
      case 'validation':
        implementation = `  const errors: string[] = [];
  
  // Add validation logic here
  // Example:
  // if (!req.body.email) errors.push('Email is required');
  // if (!req.body.password) errors.push('Password is required');
  
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  
  next();`;
        break;
        
      case 'logging':
        implementation = `  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.path} - \${res.statusCode} (\${duration}ms)\`);
  });
  
  next();`;
        break;
        
      case 'error':
        implementation = `  console.error(\`[Error] \${err.message}\`);
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });`;
        break;
        
      default:
        implementation = `  // Custom middleware logic
  console.log('${middlewareName} middleware executed');
  
  // Modify request if needed
  // req.customProperty = 'value';
  
  next();`;
    }

    const signature = type === 'error'
      ? '(err: Error & { statusCode?: number }, req: Request, res: Response, next: NextFunction)'
      : '(req: Request, res: Response, next: NextFunction)';

    const code = `import { Request, Response, NextFunction } from 'express';

/**
 * ${middlewareName} Middleware
 * ${type === 'auth' ? 'Authenticates incoming requests' : ''}
 * ${type === 'validation' ? 'Validates request data' : ''}
 * ${type === 'logging' ? 'Logs request/response information' : ''}
 * ${type === 'error' ? 'Handles application errors' : ''}
 */
export const ${middlewareName} = ${isAsync ? 'async ' : ''}${signature}${isAsync && type !== 'error' ? ': Promise<void>' : ''} => {
${implementation}
};

export default ${middlewareName};
`;

    return {
      code,
      fileName: `${middlewareName.toLowerCase()}.middleware.ts`,
      language: 'typescript',
      dependencies: ['express']
    };
  },

  getDependencies(): string[] {
    return ['express'];
  }
};

// ============================================
// Express Service Template
// ============================================

export const expressService: Template<ExpressServiceOptions> = {
  name: 'express-service',
  description: 'Express.js service class for business logic',
  framework: 'express',
  language: 'typescript',

  generate(options: ExpressServiceOptions): TemplateResult {
    const {
      serviceName,
      methods = [],
      withRepository = false
    } = options;

    const resourceName = serviceName.replace('Service', '');
    const repoName = `${resourceName}Repository`;

    const repositoryImport = withRepository
      ? `import { ${repoName} } from '../repositories/${resourceName.toLowerCase()}.repository';\n`
      : '';

    const defaultMethods: MethodDefinition[] = [
      { name: 'findAll', params: [], returnType: `Promise<${resourceName}[]>`, async: true },
      { name: 'findById', params: [{ name: 'id', type: 'string' }], returnType: `Promise<${resourceName} | null>`, async: true },
      { name: 'create', params: [{ name: 'data', type: `Create${resourceName}Dto` }], returnType: `Promise<${resourceName}>`, async: true },
      { name: 'update', params: [{ name: 'id', type: 'string' }, { name: 'data', type: `Update${resourceName}Dto` }], returnType: `Promise<${resourceName} | null>`, async: true },
      { name: 'delete', params: [{ name: 'id', type: 'string' }], returnType: 'Promise<void>', async: true }
    ];

    const methodsToUse = methods.length > 0 ? methods : defaultMethods;

    const methodImplementations = methodsToUse.map(m => {
      const params = m.params?.map(p => `${p.name}: ${p.type}`).join(', ') || '';
      return `  /**
   * ${m.description || m.name}
   */
  ${m.async ? 'async ' : ''}${m.name}(${params}): ${m.returnType || 'void'} {
    ${withRepository ? `return this.repository.${m.name}(${m.params?.map(p => p.name).join(', ') || ''});` : `// Implement ${m.name} logic
    throw new Error('Not implemented');`}
  }`;
    }).join('\n\n');

    const constructorCode = withRepository
      ? `  private repository: ${repoName};

  constructor() {
    this.repository = new ${repoName}();
  }
`
      : '';

    const code = `${repositoryImport}
// Type definitions
interface ${resourceName} {
  id: string;
  // Add properties
  createdAt: Date;
  updatedAt: Date;
}

interface Create${resourceName}Dto {
  // Add creation properties
}

interface Update${resourceName}Dto {
  // Add update properties
}

/**
 * ${serviceName}
 * Business logic for ${resourceName} operations
 */
export class ${serviceName} {
${constructorCode}
${methodImplementations}
}

export default new ${serviceName}();
`;

    return {
      code,
      fileName: `${resourceName.toLowerCase()}.service.ts`,
      language: 'typescript',
      dependencies: []
    };
  },

  getDependencies(): string[] {
    return [];
  }
};

// ============================================
// Node.js Utility Module Template
// ============================================

export interface NodeUtilityOptions extends TemplateOptions {
  utilityName: string;
  functions: { name: string; description?: string; params?: { name: string; type: string }[]; returnType?: string; async?: boolean }[];
}

export const nodeUtility: Template<NodeUtilityOptions> = {
  name: 'node-utility',
  description: 'Node.js utility module',
  framework: 'node',
  language: 'typescript',

  generate(options: NodeUtilityOptions): TemplateResult {
    const { utilityName, functions } = options;

    const functionImplementations = functions.map(fn => {
      const params = fn.params?.map(p => `${p.name}: ${p.type}`).join(', ') || '';
      return `/**
 * ${fn.description || fn.name}
${fn.params?.map(p => ` * @param ${p.name} - ${p.type}`).join('\n') || ''}
 * @returns ${fn.returnType || 'void'}
 */
export ${fn.async ? 'async ' : ''}function ${fn.name}(${params}): ${fn.returnType || 'void'} {
  // Implement ${fn.name}
  ${fn.returnType?.includes('Promise') ? 'return Promise.resolve(null as any);' : fn.returnType ? 'return null as any;' : ''}
}`;
    }).join('\n\n');

    const code = `/**
 * ${utilityName} Utilities
 * Collection of utility functions
 */

${functionImplementations}
`;

    return {
      code,
      fileName: `${utilityName.toLowerCase()}.utils.ts`,
      language: 'typescript',
      dependencies: []
    };
  },

  getDependencies(): string[] {
    return [];
  }
};

// ============================================
// Export all Express/Node templates
// ============================================

export const expressTemplates = {
  app: expressApp,
  router: expressRouter,
  controller: expressController,
  middleware: expressMiddleware,
  service: expressService,
  utility: nodeUtility
};

export default expressTemplates;
