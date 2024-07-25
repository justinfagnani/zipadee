# Zipadee vs Koa

Zipadee is heavily inspired by Koa's overall API design, so first of all I'm thankful for Koa's thoughtful and elegant design!

There are some important differences, many of which were motivation for creating a new server.

### XSS protection: Text responses are assumed to be plain text

Zipadee aims to have safe default behavior. Part of this is treating all text responses as plain text by default, and only responding with a MIME type of `text/html` (or other) if the developer specifically sets the type, or uses the built-in `html` template tag.

```ts
import {App, html} from 'zipadee';

app.use((req, res) => {
  // This is treated as plain text
  res.body = '<h1>Hello World!</h1>';
});

app.use((req, res) => {
  // This is treated as HTML
  res.body = html`<h1>Hello World!</h1>`;
});
```

In Koa, when a response body is text it's scanned for what looks like part of an HTML end tag ("`</`") and if its found, Koa automatically sets the MIME type of the response to `text/html`. This too easily allows mixing of trusted nad untrusted content, which can lead to XSS vulnerabilities.

Zipadee's `html` template tag automatically escapes untrusted interpolations. Developers must use the `unsafeHTML()` utility to interpolate non-literal template strings, and so are encouraged to think about safety up-front.

### Built-in HTML templating

Zipadee's `html` template tag offers a number of conveniences that may eliminate the need for a separate HTML template system like Liquid or Nunjucks:

- Automatic escaping\* of untrusted interpolated strings
- Composition of nested templates
- Support for arrays: Makes it easy to build lists without having to use `arr.join('')`, and supports streaming.
- Pretty-ish-printing: Templates can be automatically dedented and nested templates re-indented when a nicer looking output is desired.
- Asynchronous templates with treaming support: Zipadee streams each chunk of a template as its ready, and automatically waits for Primises in the stream.

  ```ts
  app.use(async (req, res) => {
    // Render the shell ASAP, render the body when data is loaded
    res.body = html`
      <html>
        <head>
          <script type="module" src="./app.js"></script>
          <link rel="stylesheet href="./app.css">
        </head>
        <body>
          ${renderBody(req)}
        </body>
      </html>
    `;
  });

  const renderBody = async (req) => {
    const data = await getData(req);
    return html` <h1>${data.title}</h1> `;
  };
  ```

\*Zipadee's `html` tag does not yet perform contextual auto-escaping, which requires parsing the HTML templates, so it's still possible to create unsafe attribute values like `javascript:...`.

### Native TypeScript support and easy-to-typecheck APIs

Zipadee is written in TypeScript, provides accurate type declarations with all npm packages, and has a simple, static, and easy-to-typecheck API.

Importantly, Zipadee does not change the shape of core objects, or encourage middleware to do so. This is easier for both humans and compilers to understand.

### Speed

Benchmarks are not written yet, but the operations that Zipadee performs on the core request handling path are kept very simple. Zipadee should be able to approach Fastify or raw-Node HTTP performance levels.

### `compose()` is built-in

Composing middleware is a core function that the core package uses. It doesn't need to be in a separate package.

### No context object

Context duplicates a lot of API from Request and Response, is another object to allocate for every request, and is difficult to make type-safe.

Instead of writing new fields to context or change the types of existing fields (like middleware might do with `.body`, middleware that needs to provide custom data to handlers can do so by vending a utility function to grab the data from the Request object. This is much easier to make type-safe.

For instance, the functionality of `koa-bodyparser` could be acheived by simply calling co-body on a request:

```ts
import parse from 'co-body';

app.use(async (req, res) => {
  const parsedBody = await parse.json(req);
});
```

This approach is much easier to define in a type-safe manner, and eliminates hard-to-understand coupling between possibly far-flung middleware.

If middleware needs to persist data across multiple access points, it can do so by caching in a WeakMap keyed by the request:

```ts
// This is (for now) an imaginary package
import {parseJson} from '@zipadee/bodyparser';

app.use(async (req, res) => {
  // If this is the first time the body is parsed, the result is cached
  const parsedBody = await parseJson(req);
  await next();
});

app.use(async (req, res) => {
  // If this is the second time the body is parsed, it reads from the cache
  const parsedBody = await parseJson(req);
});
```

### No request or response prototype objects

Being able to specifiy a prototype for all Request and Response objects is also hard describe in a type-safe manner. Middleware should be able to assume a consistent interface for their parameters.

### Small things

#### Fewer Request path methods

pathname, queryString, etc., are replaced by using the parsed URL object.

#### Fewer content negotiation methods.

Just one `accept` object that has its own methods.

#### Removed deprecated `parse()` usage from `node:url` package.

`parse()` has security issues that will not be fixed: https://nodejs.org/api/url.html#urlparseurlstring-parsequerystring-slashesdenotehost

#### Clearer method names

- `setHeader()` and `getHeader()` instead of `set()` and `get()`
- Just `Request.url` instead of `Request.url` and `Request.URL`.
-
