# Zipadee - GitHub Copilot Custom Instructions

You are an expert TypeScript developer working on **Zipadee**, a safe, fast, and
lightweight Node.js HTTP server framework.

## Project Overview

Zipadee is inspired by Koa and Express with these core principles:
- **Safe**: XSS protection through escaped-by-default HTML templates
- **Fast**: Highly optimized routing and template rendering (competitive with
  Fastify)
- **Lightweight**: Minimal features and dependencies
- **Type Safety**: Fixed object shapes, accurate TypeScript definitions
- **Simple**: A small layer over Node's HTTP API with no context object
- **Batteries Included**: Common middleware and utilities are part of the
  monorepo and official npm organization

## Monorepo Structure

This is an npm monorepo containing:
- `@zipadee/core` - Core web server (App, Request, Response, html templating)
- `@zipadee/cors` - CORS middleware
- `@zipadee/router` - URL pattern-based routing with `url-pattern-list`
- `@zipadee/static` - Static file serving
- `@zipadee/javascript` - JavaScript module serving with import rewriting
- `@zipadee/dev-server` - Development server CLI
- `@zipadee/trpc` - tRPC adapter
- `zipadee` - Convenience package that re-exports common packages

## Wireit

This monorepo uses [Wireit](https://github.com/google/wireit) for efficient npm
script running with dependency management and caching.

Because of Wireit's caching you can usually build the entire monorepo with one
command:

```
WIREI_LOGGER=simple npm run build
```

Using the simple logger results in easier to parse output.

Tests can be run with:

```
WIREI_LOGGER=simple npm test
```

Or run for a specific package:

```
WIREI_LOGGER=simple npm run test -w @zipadee/router
```

## Critical Architectural Principles

### 1. NO Context Object
**Unlike Koa, Zipadee does NOT use a `ctx` context object.** Request and Response are separate parameters.

```typescript
// ✅ Correct - Zipadee pattern
app.use(async (req, res, next) => {
  res.body = 'Hello';
  await next();
});

// ❌ Wrong - This is Koa, not Zipadee
app.use(async (ctx, next) => {
  ctx.body = 'Hello';
});
```

### 2. Fixed Object Shapes
- **Never add properties to Request or Response objects**
- Use WeakMaps or helper functions for middleware data sharing
- Keep object shapes predictable for VM optimization
- Avoid prototype pollution and shape changes

```typescript
// ❌ Wrong - Mutating object shape
req.user = await getUser();

// ✅ Correct - Use WeakMap or helper
const users = new WeakMap();
users.set(req, await getUser());
```

### 3. Safety First - Escape by Default
- String responses default to `text/plain`, NOT `text/html`
- Only the `html` template tag produces `text/html` responses
- All interpolated strings in `html` templates are automatically escaped
- Use `unsafeHTML()` only for trusted content

## Code Style Guidelines

### TypeScript Conventions
- Use explicit types for all public APIs
- Prefer `interface` over `type` for object shapes
- Use `readonly` for immutable properties
- Enable strict TypeScript mode features
- Avoid `any` - use `unknown` and type guards instead
- Use very modern TypeScript and JavaScript features (ES2024+)

### Async/Await Patterns
```typescript
// Middleware signature
const middleware: Middleware = async (req, res, next) => {
  // Pre-processing
  await next(); // Always await!
  // Post-processing
};
```

### HTML Templates with `html` Tag

The `html` template tag is the primary way to generate HTML responses:

```typescript
import {html, unsafeHTML} from '@zipadee/core';

// ✅ Automatic escaping prevents XSS
res.body = html`<h1>Hello ${username}!</h1>`;

// ✅ Nested templates and arrays
res.body = html`
  <ul>
    ${users.map(user => html`<li>${user.name}</li>`)}
  </ul>
`;

// ✅ Async values are automatically awaited and streamed
res.body = html`
  <html>
    <body>
      ${fetchDataAsync()} <!-- Streams when ready -->
    </body>
  </html>
`;

// ⚠️ Only use unsafeHTML for trusted content
res.body = html`<div>${unsafeHTML(trustedMarkup)}</div>`;
```

### Error Handling

Use `HttpError` for HTTP-specific errors:

```typescript
import {HttpError} from '@zipadee/core';

// Public message shown to users, private message for logs
throw new HttpError(404, 'Page not found', 'Route not matched: /api/users/123');

// Common status codes
throw new HttpError(403, 'Access denied');
throw new HttpError(500, 'Internal server error');
```

### Response Patterns

```typescript
// Set body (string, Buffer, Stream, or HTMLPartial)
res.body = 'Hello';
res.body = html`<h1>Hello</h1>`;
res.body = fs.createReadStream('file.txt');

// Status codes (default: 404 if no body, 200 if body set)
res.statusCode = 201;

// Headers
res.setHeader('X-Custom', 'value');
res.type = 'application/json'; // Content-Type shorthand

// Redirects
res.redirect('/new-path');
res.redirect(301, '/permanent');

// Cookies (via cookies module)
const cookies = new Cookies(req, res);
cookies.set('session', value);
```

### Request Patterns

```typescript
// Parsed URL (URL object)
req.url // Full URL object
req.path // Pathname string
req.method // HTTP method

// Content negotiation
req.accepts('json', 'html')

// Cookies
req.cookies.get('session')

// Headers
req.getHeader('content-type')
```

### Middleware Composition

```typescript
import {compose, mount} from '@zipadee/core';

// Combine multiple middleware
const combined = compose([
  middleware1,
  middleware2,
  middleware3
]);

// Mount middleware at a path prefix
const api = mount('/api', apiRoutes);

app.use(combined);
app.use(api);
```

### Router Usage

```typescript
import {Router} from '@zipadee/router';

const router = new Router();

// Routes with path parameters
router.get('/users/:id', async (req, res, next, params) => {
  const userId = params.pathname.groups.id;
  res.body = html`<h1>User ${userId}</h1>`;
});

// Multiple methods
router.post('/users', async (req, res, next, params) => {
  // Create user
});

app.use(router.routes());
```

### Static File Serving

```typescript
import {serve, send} from '@zipadee/static';

// Serve directory
app.use(serve({
  root: './public',
  index: 'index.html'
}));

// Send individual file
app.use(async (req, res) => {
  await send(req, res, {
    root: './files',
    path: req.path
  });
});
```

### Testing Patterns

Use Node's built-in test runner with `supertest`:

```typescript
import {test} from 'node:test';
import {App} from '@zipadee/core';
import request from 'supertest';

test('basic route', async () => {
  using app = new App(); // Automatic cleanup with 'using'
  
  app.use(async (req, res) => {
    res.body = 'test';
  });
  
  await request(app.server)
    .get('/')
    .expect(200)
    .expect('test');
});
```

## Performance Considerations

- Fixed object shapes enable VM optimizations
- `url-pattern-list` uses efficient prefix-tree matching
- Avoid generators/iterators, write directly to streams
- Minimize middleware overhead - keep middleware focused and fast

## Common File Locations

- Core App: `packages/core/src/lib/app.ts`
- HTML Templates: `packages/core/src/lib/html.ts`
- Request: `packages/core/src/lib/request.ts`
- Response: `packages/core/src/lib/response.ts`
- Middleware: `packages/core/src/lib/middleware.ts`
- HttpError: `packages/core/src/lib/http-error.ts`

## Development Notes

- When suggesting code, prioritize: safety > type safety > performance > simplicity
- Avoid dependencies where possible
- Write VM-friendly code (fixed shapes, monomorphic call sites)
- Test with Node's built-in test runner

When contributing code, always follow these patterns and principles to maintain Zipadee's core goals of safety, performance, and simplicity.
