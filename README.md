# Zipadee

Zipadee is a simple Node HTTP server with middleware.

Zipadee is inspired by Koa and Express, with the following goals:

- Ergonomic: Usability improvements on raw Node HTTP APIs
- Familiar: App and Middleware similar to Express and Koa
- Simple: A small API over Node HTTP
- Lightweight: Minimal features and dependencies
- Great TypeScript support:
  - Written in TypeScript so typings are always included and accurate
  - Objects have known shapes that are easy to type
- Safe: The easist way to repond with HTML is escaped by default
- Convenient: The most common needs are easy to address

## Ergonomics

- Make it east to respond
  - Response.body
  - content type
  - content length
  - response code
  - headers
  - cookies
- Request
  - path

## Differences from Koa

### `compose()` is built-in

- Composing middleware is a core function that the App class uses. It doesn't need to be in a separate package.

### Reduced API

- No context. Context duplicates a lot of API from Request and Response, is another object to allocate for every request, and is difficult to make type-safe. Middleware that needs to provide custom data to handlers can do so by vending a utility function to grab the data from the Request object. This is much easier to make type-safe.
- Fewer Request path methods. pathname, queryString, etc., are replaced by using the parsed URL object.
- Fewer content negotiation methods. Just one `accept` object that has its own methods.
- Removed deprecated `parse()` usage from `node:url` package.
- No request or response prototype objects

## TODO

- `mount()` middleware in core (or router?) for mouting other middleware at a subpath.
- `@zipadee/router`
- Body parsers
  - JSON Schema validation for JSON bodies?
- `@zipadee/csp` package that makes it easy to set CSP headers and to create nonces and use them in other middleware.

  ```ts
  import {getNonce} from '@zipadee/csp';

  app.use((req, res) => {
    res.body = `<script nonce=${getNonce(req)}>...</script>`;
  });
  ```

- `@zipadee/etag` (or `@zipadee/cache`?) - easily set ETag header from content. Maybe it could be used by `@zipadee/static`.
- Web site
- http2: test against Node's compatability layer, offer a switch?
  - Local cert generation for local HTTP/2 dev servers?
- compress midleware
-
