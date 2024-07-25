# Zipadee

Zipadee is a simple Node HTTP server with middleware.

Zipadee is inspired by Koa and Express, with the following goals:

- Ergonomic: Usability improvements on raw Node HTTP APIs
- Familiar: App and Middleware similar to Express and Koa
- Simple: A small API over Node HTTP
- Lightweight: Minimal features and dependencies
- Great TypeScript support:
  - Written in TypeScript so typings are always included and accurate
  - Objects have fixed shapes that are easy to type
- Safe: The easist way to repond with HTML is escaped by default to protect against XSS
- Convenient: The most common needs are easy to address, whether with a built-in feature or first-class middleware.

## Ergonomics

- Response
  - Response.body
  - content type
  - content length
  - response code
  - headers
  - cookies
- Request
  - path
  - accepts
  - cookies

## Differences from Koa

### `html` templates

- Lit-like template on the server-side that support composition, lists, async, and escape interpolations by default.

### No context object

- Context duplicates a lot of API from Request and Response
- Context is another object to allocate for every request
- Context changes shape over time, making it hard for VMs to optimize and very difficult to make type-safe.

Middleware that needs to provide custom data to handlers can do so by vending a utility function to grab the data from the Request object. This is much easier to make type-safe.

### `compose()` is built-in

- Composing middleware is a core function that the App class uses. It doesn't need to be in a separate package.

### `mount()` is built-in

- Mounting is very common, and requires that middleware use `req.path` instead of `req.url.pathname`, so that convention should be standard

- No request or response prototype objects

### Etc...

- Fewer Request path methods. pathname, queryString, etc., are replaced by using the parsed URL object.
- Fewer content negotiation methods. Just one `accept` object that has its own methods.
- Removed deprecated `parse()` usage from `node:url` package.

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
