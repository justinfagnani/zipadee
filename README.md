# Zipadee

Zipadee is a simple Node HTTP server with middleware.

> [!CAUTION]
> Zipadee is very early, under construction, will change a lot, and may never be sufficiently maintained for any level of use. If you want to try it, please consider contributing!

> [!IMPORTANT]
> I'm looking for collaborators for Zipadee! I don't have enough time to make
> Zipadee a well-supported project on my own, and I can't possibly use it in
> enough different cases to shake out all of the basic features and initial
> bugs. It the goals and principles of the project speak to you, reach out!

Zipadee is inspired by Koa and Express, with the following goals:

- Ergonomic: Usability improvements on raw Node HTTP APIs
- Familiar: App and Middleware similar to Express and Koa
- Simple: A small API over Node HTTP
- Lightweight: Minimal features and dependencies
- Great TypeScript support:
  - Written in TypeScript so typings are always included and accurate
  - Objects have fixed shapes that are easy to type
- Safe: The easist way to repond with HTML is escaped by default to protect
  against XSS
- Convenient: The most common needs are easy to address, whether with a built-in
  feature or first-class middleware.

```ts
import {App, html} from 'zipadee';

const users = ['Alice', 'Bob'];

const app = new App();

app.use(async (req, res) => {
  res.body = html`
    <h1>Hello world!</h1>
    <h2>Users:</h2>
    <ul>
      ${users.map((user, i) => html` <li>User ${i}: ${user}</li> `)}
    </ul>
  `;
});

app.listen(8080);
```

## Principles and features

### Fixed object shapes

One of the biggest differences from Koa, and other web server frameworks as
well, is that Zipadee doesn't encourage middleware to change the shape of
objects as a standard way of passing data between middleware or plugins -
whether adding new properties to objects or changing the types of properties.

Changing object shapes are hard for everything that deals with code to
handle well: VMs, compilers and type-checkers, and humans.

For instance, in other server frameworks, middleware will often add new
properties to a context object. Later middleware will access those properties,
and only work if the other middleware is present, but there's very little to
tell code readers about that dependency.

Zipadee doesn't have a context object, but instead encourages middleware that
needs to vend data to other middleware to do so via lookup APIs.

Zipadee also doesn't include a way to replace the Request and Response classes,
so middleware always knows the types of objects that it is receiving.

#### Examples of alternatives to context

##### Get data from Request and Response objects with helpers

Consider a CSP middleware that helps set the Content-Security-Policy
header and generate nonces to use in HTML generated by downstream middleware.
Instead of adding a `nonce` property to a context, the middleware can offer a
utility function to get the nonce from the Response object. This function can
read from a WeakMap keyed by the Response (it could add a property to Response
too, but Zipadee discourages that).

```ts
import {csp, getNonce} from 'some-zipadee-csp-package';

app.use(csp({styleNonce: true}));

app.use(async (req, res) => {
  // The getNonce() function can give nice error messages if the csp()
  // middleware wasn't used, and it can have nice hover-over docs for developers
  const styleNonce = getNonce(res);
  res.body = html`<style nonce=${styleNonce}`>...</style>`;
});
```

##### Use functions instead of middleware

Request body parsing is commonly done with middleware, but to pass the parsed
request body to downstream middleware, parsers usually modify the Request
object. This reads the body stream before other middleware can, and changes the
type of the body (say to JSON). Given that these changes cna cause downstream
bugs, Zipadee encourages using simple functions instead. Middleware that needs
to parse the request body as JSON can just use a function:

```ts
import {parseBody} from 'some-body-parser';

app.use(async (req, res, next) => {
  const json = await parseBody(req);
  //     ^ this is typed nicely as a JSON object. No guessing
});
```

If multiple readers need access to the parsed body, `parseBody()` could cache
the result in a WeakMap.

### Safety

Zipadee aims to have safe default behavior. Part of this is treating all text
responses as plain text by default, and only responding with a MIME type of
`text/html` (or other) if the developer specifically sets the type, or uses the
built-in `html` template tag.

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

In Koa, when a response body is a string it is scanned for what looks like part
of an HTML end tag ("`</`") and if it's found, Koa automatically sets the MIME
type of the response to `text/html`. This too easily allows mixing of trusted
nad untrusted content, which can lead to XSS vulnerabilities.

Zipadee's `html` template tag automatically escapes untrusted interpolations.
Developers must use the `unsafeHTML()` utility to interpolate
non-template-literal strings, encouraging developers to think about safety
up-front.

### Built-in HTML templating

Zipadee's `html` template tag offers a number of conveniences that may eliminate
the need for a separate HTML template system like Liquid or Nunjucks:

- Automatic escaping\* of untrusted interpolated strings
- Composition of nested templates
- Support for arrays: Makes it easy to build lists without having to use
  `arr.join('')`, and supports streaming.
- Pretty-ish-printing: Templates can be automatically dedented and nested
  templates re-indented when a nicer looking output is desired.
- Asynchronous templates with streaming support: Zipadee streams each chunk of a
  template as its ready, and automatically waits for Primises in the stream.

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

\*Zipadee's `html` tag does not yet perform contextual auto-escaping, which
requires parsing the HTML templates, so it's still possible to create unsafe
attribute values like `javascript:...`.

### Core utilities included

Utilities like `compose()` and `mount()` are core to using middleware correctly,
and help define some of the semantics of middleware, so they are built-in to
Zipadee.

`compose()` specifically is use by the `App` class to compose the top-level
middleware. Including it is one less dependency in core.

`mount()` defines in part how middleware should handle paths. It doesn't modify
a Request's URL object, but the Request's `path`, so all middleware should use
the `path` property to make sure that it can be mounted properly. Because of how
important that is, `mount()` is built-in.

## TODO

There are many, many things to be done if Zipadee is ever going to be real, but here's a few of them:

- [ ] Web site
- [ ] Finish `@zipadee/static`
- [ ] Finish `@zipadee/router`
- [ ] Benchmarks (Use Fastify's? It's maye too simple)
- [ ] Body parsers (and JSON Schema validation for JSON bodies?)
- [ ] `@zipadee/csp` package that makes it easy to set CSP headers and to create nonces and use them in other middleware.

  ```ts
  import {getNonce} from '@zipadee/csp';

  app.use((req, res) => {
    res.body = `<script nonce=${getNonce(res)}>...</script>`;
  });
  ```

- [ ] `@zipadee/etag` (or `@zipadee/cache`?) - easily set ETag header from content. Maybe it could be used by `@zipadee/static`.
- [ ] http2: test against Node's compatability layer, offer a switch?
  - Local cert generation for local HTTP/2 dev servers?
- [ ] `@zipadee/compress` midleware
- [ ] `@zipadee/trpc` midleware
