# @zipadee/dev-server

A simple dev-server CLI.

## Overview

zpd is a web development server built with Zipadee. It serves JavaScript files
and rewrites npm-style module specifiers to be browser-compatible by resolving them to
on-disk paths.

## Usage

```
zpd [options]
```

Options:

- `--port`, `-p` The port to listen on. (default: 8080)
- `--root`, `-r` Root directory to serve files from. (default: Current working directory)
- `--base`, `-b` Base directory to resolve paths and imports from, as a relative path
  from the root directory. (default: '')
- `--css-modules` Whether to transform CSS modules to JavaScript.

  If true, CSS imports - imports with a `type: 'css'` import attribute - will be transformed to remove the `type: 'css'` attribute and add a `?type=css--module` query parameter to the URL.
  
  Requests for these URLs will be served as JavaScript modules that export the CSS as a CSSStyleSheet object. (default: false)
- `--help`          Show the help message (default: false)

zpd serves files from the specified root directory (default: cwd).

Absolute paths and JavaScript module specifiers are resolved relative to the
base directory if set, otherwise to the root directory. If a module specifier
resolves to a path outside of the base directory, it is rewritten to be relative
to the root directory by prefixing it with the a special root path prefix.

Example:

If you have a monorepo with packages at `packages/foo` and `packages/bar`
and you want to serve content from the package `foo`, you should set the root
to the monorepo root and base to `packages/foo`.

`import 'bar'` from within the `foo` package will be rewritten to `import
'/__root__/packages/bar/index.js'`, and the server will serve the file from
`packages/bar/index.js`.
