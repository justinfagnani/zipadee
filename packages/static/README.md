# @zipadee/static

Static file serving utilities and middleware for the Zipadee web server.

> [!CAUTION]
> Zipadee is very early, under construction, will change a lot, and may never be sufficiently maintained for any level of use. If you want to try it, please consider contributing!

`@zipadee/static` has two main exports:

- `send`: a helper function which sends a single file - by file path - to a Response
- `serve`: middleware that serves a folder of files

## Usage

```ts
import {App} from 'zipadee';
import {send, serve} from '@zipadee/static';

const app = new App();

// Serves all files in the directory {cwd}/files/
app.use(serve({root: 'files'}));

app.use(async (req, res, next) => {
  if (req.path === '/hello') {
    // Sends {cwd}/hello.html to the response
    await send(req, res, 'hello.html');
  }
  await next();
});

app.listen();
```
