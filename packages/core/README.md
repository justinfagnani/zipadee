# @zipadee/core

A simple Node HTTP server with middleware.

> [!CAUTION]
> Zipadee is very early, under construction, will change a lot, and may never be sufficiently maintained for any level of use. If you want to try it, please consider contributing!

## Usage

```ts
import {App, html} from '@zipadee/core';

const app = new App();

app.use(async (req, res) => {
  res.body = html`<h1>Hello world!</h1>`;
});

app.listen();
```

## Features

### HTML Templates

<!-- Keep in sync with docs/Koa-comparison.md or link from there to here -->

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
