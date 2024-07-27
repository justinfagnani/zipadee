import {HttpError, type Middleware} from '@zipadee/core';
import {
  decodePath,
  pathIsHidden,
  resolvePath,
  stat,
} from '@zipadee/static/lib/utils.js';
import {send} from '@zipadee/static';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parse, init} from 'es-module-lexer';
import {moduleResolve} from 'import-meta-resolve';

await init;

export interface Options {
  /**
   * Root directory to restrict file access. Defaults to the current working
   * directory.
   */
  root?: string;

  /**
   * Base path to resolve imports from. Defaults to the current working
   * directory.
   */
  base?: string;

  /**
   * Imports resolved to outside of the base path will be prefixed with this
   * string. Defaults to `/__root__`.
   */
  rootPathPrefix?: string;

  /**
   * Array of file extensions to transform. Defaults to `['.js', '.mjs']`.
   *
   * Other extensions are served as plain files.
   */
  extensions?: Array<string>;

  /**
   * Array of import conditions to support. Defaults to `['browser', 'import']`.
   */
  conditions?: Array<string>;
}

// TODO:
// - Add caching for both specifier resolution and files
// - Prepopulate the cache based on the module graph
// - Add support for dynamic imports
// - Add support for import maps?
// - Test support for import attributes
// - Add option for import conditions
// - Add support for transforming <script type="module"> tags in HTML
// - Automatically handle CORS requests?

/**
 * Serve static JavaScript files from a `root` directory.
 */
export const serve = (opts: Options): Middleware => {
  const root =
    opts.root === undefined ? process.cwd() : path.resolve(opts.root);
  const base = opts.base === undefined ? root : resolvePath(root, opts.base);
  const rootPathPrefix = opts.rootPathPrefix ?? '/__root__';
  const extensions = opts.extensions ?? ['.js', '.mjs'];
  const conditionsArray = opts.conditions ?? ['browser', 'import'];
  const conditions = new Set(conditionsArray);

  return async (req, res, next) => {
    if (!(req.method === 'HEAD' || req.method === 'GET')) {
      // TODO: implement HEAD?
      return await next();
    }

    let filePath = decodePath(req.path);

    const mountedPath = req.url!.pathname.substring(
      0,
      req.url!.pathname.length - filePath.length,
    );

    const parsedPath = path.parse(filePath);
    const transform = extensions.includes(parsedPath.ext);

    if (filePath.startsWith(rootPathPrefix)) {
      filePath = filePath.substring(rootPathPrefix.length);
      filePath = filePath.slice(parsedPath.root.length);
      filePath = resolvePath(root, filePath);
    } else {
      filePath = filePath.slice(parsedPath.root.length);
      filePath = resolvePath(base, filePath);
    }

    if (pathIsHidden(root, filePath)) {
      return await next();
    }

    const stats = await stat(filePath);

    if (stats.isDirectory()) {
      return await next();
    }

    if (!transform) {
      const relativePath = path.relative(root, filePath);
      await send(req, res, relativePath, {root});
      return;
    }

    const source = await fs.readFile(filePath, 'utf8');
    const [imports, _exports, _facade, _hasModuleSyntax] = parse(
      source,
      filePath,
    );
    let output = '';
    let lastIndex = 0;

    for (const impt of imports) {
      const {t: type, s: start, e: end, n: unescaped} = impt;
      if (type === 1) {
        // Static import
        const importSpecifier = unescaped || source.substring(start, end);

        // If the specifier is relative or absolute, we don't need to resolve it
        if (
          importSpecifier.startsWith('.') ||
          importSpecifier.startsWith('/')
        ) {
          output += `${source.substring(lastIndex, start)}${importSpecifier}`;
          lastIndex = end;
          continue;
        }

        const fileURL = new URL(filePath, 'file://');
        const resolvedImportURL = moduleResolve(
          importSpecifier,
          fileURL,
          conditions,
        );
        const resolvedImportPath = resolvedImportURL.pathname;

        if (!resolvedImportPath.startsWith(root)) {
          throw new HttpError(500);
        }

        let resolvedimport: string;
        if (resolvedImportPath.startsWith(base)) {
          resolvedimport = resolvedImportPath.substring(base.length);
        } else {
          resolvedimport = path.join(
            mountedPath,
            rootPathPrefix,
            resolvedImportPath.substring(root.length),
          );
        }

        output += `${source.substring(lastIndex, start)}${resolvedimport}`;
        lastIndex = end;
      }
    }

    res.type = 'text/javascript';
    res.body = output + source.substring(lastIndex);
  };
};
