/**
 * The Joker - Agentic Terminal
 * Next.js Framework Templates
 */

import { Template, TemplateOptions, TemplateResult, PageOptions, PropDefinition } from './types';

// ============================================
// Next.js Specific Options
// ============================================

export interface NextPageOptions extends PageOptions {
  /** App Router or Pages Router */
  router?: 'app' | 'pages';
  /** Generate metadata */
  generateMetadata?: boolean;
  /** Server or Client component */
  componentType?: 'server' | 'client';
  /** Parallel routes */
  parallelRoutes?: string[];
  /** Intercepting route */
  intercepting?: boolean;
}

export interface NextApiOptions extends TemplateOptions {
  /** Route handler name */
  handlerName: string;
  /** HTTP methods to handle */
  methods: ('GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE')[];
  /** Use Edge runtime */
  edge?: boolean;
  /** Dynamic route params */
  params?: string[];
  /** Response type */
  responseType?: string;
}

export interface NextLayoutOptions extends TemplateOptions {
  /** Layout name */
  layoutName: string;
  /** Include navigation */
  withNavigation?: boolean;
  /** Include footer */
  withFooter?: boolean;
  /** Metadata for the layout */
  metadata?: {
    title?: string;
    description?: string;
  };
}

export interface NextComponentOptions extends TemplateOptions {
  componentName: string;
  props?: PropDefinition[];
  isClient?: boolean;
  withSuspense?: boolean;
}

// ============================================
// Next.js App Router Page Template
// ============================================

export const nextAppPage: Template<NextPageOptions> = {
  name: 'nextjs-app-page',
  description: 'Next.js App Router page component',
  framework: 'nextjs',
  language: 'typescript',

  generate(options: NextPageOptions): TemplateResult {
    const {
      pageName,
      title = pageName,
      description = `${pageName} page`,
      dataFetching = 'server',
      withLoading = false,
      withErrorBoundary = false,
      componentType = 'server',
      generateMetadata = true,
      typescript = true
    } = options;

    const isClient = componentType === 'client';
    const clientDirective = isClient ? "'use client';\n\n" : '';

    const imports: string[] = [];
    if (!isClient && dataFetching === 'server') {
      imports.push("import { Suspense } from 'react'");
    }
    if (isClient) {
      imports.push("import { useState, useEffect } from 'react'");
    }

    const metadataExport = generateMetadata && !isClient ? `
export const metadata = {
  title: '${title}',
  description: '${description}',
};
` : '';

    let dataFetchingCode = '';
    let componentBody = '';

    if (isClient) {
      componentBody = `  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch data client-side
        const response = await fetch('/api/data');
        const result = await response.json();
        setData(result);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }`;
    } else if (dataFetching === 'server') {
      dataFetchingCode = `
async function getData() {
  // Fetch data server-side
  // const res = await fetch('https://api.example.com/data', { next: { revalidate: 3600 } });
  // return res.json();
  return { message: 'Hello from server' };
}
`;
    }

    const code = `${clientDirective}${imports.length > 0 ? imports.join('\n') + '\n' : ''}${metadataExport}${dataFetchingCode}
export default ${dataFetching === 'server' && !isClient ? 'async ' : ''}function ${pageName}Page() {
${isClient ? componentBody : '  const data = await getData();'}

  return (
    <main className="${pageName.toLowerCase()}-page">
      <h1>${title}</h1>
      <p>${description}</p>
      {/* Page content */}
    </main>
  );
}
`;

    const result: TemplateResult = {
      code,
      fileName: 'page.tsx',
      language: 'typescript',
      dependencies: ['next', 'react']
    };

    // Add loading.tsx if requested
    if (withLoading) {
      result.additionalFiles = result.additionalFiles || [];
      result.additionalFiles.push({
        fileName: 'loading.tsx',
        code: `export default function Loading() {
  return (
    <div className="loading-container">
      <div className="loading-spinner" />
      <p>Loading...</p>
    </div>
  );
}
`,
        language: 'typescript'
      });
    }

    // Add error.tsx if requested
    if (withErrorBoundary) {
      result.additionalFiles = result.additionalFiles || [];
      result.additionalFiles.push({
        fileName: 'error.tsx',
        code: `'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="error-container">
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  );
}
`,
        language: 'typescript'
      });
    }

    return result;
  },

  getDependencies(): string[] {
    return ['next', 'react', 'react-dom'];
  }
};

// ============================================
// Next.js Layout Template
// ============================================

export const nextLayout: Template<NextLayoutOptions> = {
  name: 'nextjs-layout',
  description: 'Next.js App Router layout component',
  framework: 'nextjs',
  language: 'typescript',

  generate(options: NextLayoutOptions): TemplateResult {
    const {
      layoutName,
      withNavigation = true,
      withFooter = true,
      metadata,
      typescript = true
    } = options;

    const metadataExport = metadata ? `
export const metadata = {
  title: '${metadata.title || layoutName}',
  description: '${metadata.description || 'Application layout'}',
};
` : '';

    const navComponent = withNavigation ? `
function Navigation() {
  return (
    <nav className="main-navigation">
      <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul>
    </nav>
  );
}
` : '';

    const footerComponent = withFooter ? `
function Footer() {
  return (
    <footer className="main-footer">
      <p>&copy; ${new Date().getFullYear()} ${layoutName}. All rights reserved.</p>
    </footer>
  );
}
` : '';

    const code = `import './globals.css';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });
${metadataExport}${navComponent}${footerComponent}
export default function ${layoutName}Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        ${withNavigation ? '<Navigation />' : ''}
        <main className="main-content">
          {children}
        </main>
        ${withFooter ? '<Footer />' : ''}
      </body>
    </html>
  );
}
`;

    return {
      code,
      fileName: 'layout.tsx',
      language: 'typescript',
      dependencies: ['next', 'react']
    };
  },

  getDependencies(): string[] {
    return ['next', 'react', 'react-dom'];
  }
};

// ============================================
// Next.js API Route Handler Template
// ============================================

export const nextApiRoute: Template<NextApiOptions> = {
  name: 'nextjs-api-route',
  description: 'Next.js App Router API route handler',
  framework: 'nextjs',
  language: 'typescript',

  generate(options: NextApiOptions): TemplateResult {
    const {
      handlerName,
      methods = ['GET'],
      edge = false,
      params = [],
      typescript = true
    } = options;

    const runtimeConfig = edge ? `
export const runtime = 'edge';
` : '';

    const typeImports = typescript ? `import { NextRequest, NextResponse } from 'next/server';

` : '';

    const paramsType = params.length > 0
      ? `{ params }: { params: { ${params.map(p => `${p}: string`).join('; ')} } }`
      : '';

    const handlers = methods.map(method => {
      const asyncParams = paramsType ? `request: NextRequest, ${paramsType}` : 'request: NextRequest';
      
      return `export async function ${method}(${asyncParams}) {
  try {
    // Handle ${method} request
    ${params.length > 0 ? `const { ${params.join(', ')} } = params;` : ''}
    
    ${method === 'GET' ? `return NextResponse.json({ message: 'Success', data: null });` : ''}
    ${method === 'POST' ? `const body = await request.json();
    // Process the request body
    return NextResponse.json({ message: 'Created', data: body }, { status: 201 });` : ''}
    ${method === 'PUT' || method === 'PATCH' ? `const body = await request.json();
    // Update the resource
    return NextResponse.json({ message: 'Updated', data: body });` : ''}
    ${method === 'DELETE' ? `// Delete the resource
    return NextResponse.json({ message: 'Deleted' });` : ''}
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}`;
    }).join('\n\n');

    const code = `${typeImports}${runtimeConfig}${handlers}
`;

    return {
      code,
      fileName: 'route.ts',
      language: 'typescript',
      dependencies: ['next']
    };
  },

  getDependencies(): string[] {
    return ['next'];
  }
};

// ============================================
// Next.js Server Component Template
// ============================================

export const nextServerComponent: Template<NextComponentOptions> = {
  name: 'nextjs-server-component',
  description: 'Next.js Server Component',
  framework: 'nextjs',
  language: 'typescript',

  generate(options: NextComponentOptions): TemplateResult {
    const {
      componentName,
      props = [],
      withSuspense = false,
      typescript = true
    } = options;

    const propsInterface = typescript && props.length > 0
      ? `interface ${componentName}Props {\n${props.map(p => `  ${p.name}${p.required ? '' : '?'}: ${p.type};`).join('\n')}\n}\n\n`
      : '';

    const propsArg = props.length > 0
      ? typescript
        ? `{ ${props.map(p => p.name).join(', ')} }: ${componentName}Props`
        : `{ ${props.map(p => p.name).join(', ')} }`
      : '';

    const suspenseWrapper = withSuspense ? `import { Suspense } from 'react';

function ${componentName}Fallback() {
  return <div>Loading ${componentName}...</div>;
}

export function ${componentName}WithSuspense(${propsArg ? `props: ${componentName}Props` : ''}) {
  return (
    <Suspense fallback={<${componentName}Fallback />}>
      <${componentName} ${propsArg ? '{...props}' : ''} />
    </Suspense>
  );
}

` : '';

    const code = `${suspenseWrapper}${propsInterface}async function getData() {
  // Server-side data fetching
  // This runs on the server only
  return { message: 'Server data' };
}

export default async function ${componentName}(${propsArg}) {
  const data = await getData();

  return (
    <div className="${componentName.toLowerCase()}-container">
      <h2>${componentName}</h2>
      {/* Server-rendered content */}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
`;

    return {
      code,
      fileName: `${componentName}.tsx`,
      language: 'typescript',
      dependencies: ['next', 'react']
    };
  },

  getDependencies(): string[] {
    return ['next', 'react'];
  }
};

// ============================================
// Next.js Client Component Template
// ============================================

export const nextClientComponent: Template<NextComponentOptions> = {
  name: 'nextjs-client-component',
  description: 'Next.js Client Component',
  framework: 'nextjs',
  language: 'typescript',

  generate(options: NextComponentOptions): TemplateResult {
    const {
      componentName,
      props = [],
      typescript = true
    } = options;

    const propsInterface = typescript && props.length > 0
      ? `interface ${componentName}Props {\n${props.map(p => `  ${p.name}${p.required ? '' : '?'}: ${p.type};`).join('\n')}\n}\n\n`
      : '';

    const propsArg = props.length > 0
      ? typescript
        ? `{ ${props.map(p => p.name).join(', ')} }: ${componentName}Props`
        : `{ ${props.map(p => p.name).join(', ')} }`
      : '';

    const code = `'use client';

import { useState, useEffect, useCallback } from 'react';

${propsInterface}export default function ${componentName}(${propsArg}) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = useCallback(() => {
    // Handle client-side interaction
    console.log('Clicked!');
  }, []);

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  return (
    <div className="${componentName.toLowerCase()}-container">
      <h2>${componentName}</h2>
      <button onClick={handleClick}>
        Click me
      </button>
      {/* Client-side interactive content */}
    </div>
  );
}
`;

    return {
      code,
      fileName: `${componentName}.tsx`,
      language: 'typescript',
      dependencies: ['next', 'react']
    };
  },

  getDependencies(): string[] {
    return ['next', 'react'];
  }
};

// ============================================
// Next.js Middleware Template
// ============================================

export interface NextMiddlewareOptions extends TemplateOptions {
  /** Routes to match */
  matcher?: string[];
  /** Include authentication check */
  withAuth?: boolean;
  /** Include rate limiting */
  withRateLimit?: boolean;
}

export const nextMiddleware: Template<NextMiddlewareOptions> = {
  name: 'nextjs-middleware',
  description: 'Next.js Middleware',
  framework: 'nextjs',
  language: 'typescript',

  generate(options: NextMiddlewareOptions): TemplateResult {
    const {
      matcher = ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
      withAuth = true,
      withRateLimit = false
    } = options;

    const authCheck = withAuth ? `
  // Check for authentication
  const token = request.cookies.get('auth-token')?.value;
  
  if (!token && isProtectedRoute(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }` : '';

    const rateLimitCheck = withRateLimit ? `
  // Simple rate limiting (use Redis in production)
  const ip = request.ip ?? '127.0.0.1';
  // Implement rate limiting logic here` : '';

    const code = `import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard', '/profile', '/settings'];

function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(route => pathname.startsWith(route));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
${authCheck}${rateLimitCheck}

  // Add custom headers
  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);

  return response;
}

export const config = {
  matcher: ${JSON.stringify(matcher)},
};
`;

    return {
      code,
      fileName: 'middleware.ts',
      language: 'typescript',
      dependencies: ['next']
    };
  },

  getDependencies(): string[] {
    return ['next'];
  }
};

// ============================================
// Export all Next.js templates
// ============================================

export const nextjsTemplates = {
  page: nextAppPage,
  layout: nextLayout,
  apiRoute: nextApiRoute,
  serverComponent: nextServerComponent,
  clientComponent: nextClientComponent,
  middleware: nextMiddleware
};

export default nextjsTemplates;
