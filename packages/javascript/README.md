# @zipadee/javascript

Zipadee middleware for serving JavaScript modules

> [!CAUTION] Zipadee is very early, under construction, will change a lot, and
> may never be sufficiently maintained for any level of use. If you want to try
> it, please consider contributing!

`@zipadee/javascript` serves static JavaScript files from disk and transforms
them to resolve bare import specifiers to relative paths.

## Usage

```ts
import {App} from 'zipadee';
import {serve as serveJS} from '@zipadee/javascript';
import {serve} from '@zipadee/static';

const app = new App();

// Serves all JS files in the directory {cwd}/files/
app.use(serveJS({root: 'files'}));

// Serves all other files in the directory {cwd}/files/
app.use(serve({root: 'files'}));

app.listen();
```

## Options

- `base`: The directory that paths are resolved against to find on disk. This directory is typically where first-party JavaScript files are located. Must be a subpath of `root`. Defaults to the value of `root`.
- `root`: The root directory that files are restricted to. Import specifiers can resolve to a path outside of `base` (this is common with npm dependencies, and monorepos), but they are disallowed to be served from outside of `root`. Defaults to the current working directory.
- `rootPathPrefix`: Imports that resolve to outside of the base directory are prefixed with the `rootPathPrefix` in order to resolve them against the `root` directory instead of the `base` directory. Defaults to `'/__root__'`.
- `extensions`: Array of file extensions to serve. Defaults to `['.js', '.mjs']`. Files not matching these extensions will not be handled by this middleware. They can be served by other downstream middleware.
