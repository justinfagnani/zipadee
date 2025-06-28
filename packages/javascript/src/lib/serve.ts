import {HttpError, type Middleware} from '@zipadee/core';
import {send} from '@zipadee/static';
import {
  decodePath,
  pathIsHidden,
  resolvePath,
  stat,
} from '@zipadee/static/lib/utils.js';
import resolve from 'enhanced-resolve';
import {init, parse} from 'es-module-lexer';
import baseFS from 'fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {parseImportAttributes} from './attributes.js';

const {CachedInputFileSystem, ResolverFactory} = resolve;

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

  /**
   * If true, will transform CSS modules and imports with the `type: 'css'`
   * attribute.
   */
  cssModules?: boolean;
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

  const {
    rootPathPrefix = '/__root__',
    extensions = ['.js', '.mjs'],
    conditions = ['browser', 'import'],
    cssModules = false,
  } = opts;

  const resolver = ResolverFactory.createResolver({
    fileSystem: new CachedInputFileSystem(baseFS, 4000),
    roots: [root, base],
    extensions: ['.js', '.json'],
    conditionNames: conditions,
    mainFields: ['module', 'browser', 'main'],
  });

  return async (req, res, next) => {
    if (!(req.method === 'HEAD' || req.method === 'GET')) {
      // TODO: implement HEAD?
      return await next();
    }

    let filePath = decodePath(req.path);

    const parsedPath = path.parse(filePath);
    const isCssModule = req.url.searchParams.get('type') === 'css-module';

    const transform = isCssModule || extensions.includes(parsedPath.ext);

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

    if (isCssModule) {
      const source = await fs.readFile(filePath, 'utf8');
      res.type = 'text/javascript';
      res.body = `const styleSheet = new CSSStyleSheet();
styleSheet.replaceSync(\`${source.replace(/`/g, '\\`')}\`);
export default styleSheet;
`;
      return;
    }

    // Derive the mount prefix by removing the request path which mount() sets
    // from the URL path.
    const mountPrefix = req.url!.pathname.substring(
      0,
      req.url!.pathname.length - req.path.length,
    );
    const source = await fs.readFile(filePath, 'utf8');
    const [imports, _exports, _facade, _hasModuleSyntax] = parse(
      source,
      filePath,
    );
    let output = '';
    let lastIndex = 0;

    for (const impt of imports) {
      const {
        t: type,
        s: start,
        e: specifierEnd,
        n: unescaped,
        a: assert,
        se: importEnd,
      } = impt;

      if (type === 1) {
        // Static import

        let importSpecifier =
          unescaped ?? source.substring(start, specifierEnd);

        let resolve = false;
        let cssImportTransform = false;

        let relativeImport = false;
        let absoluteImport = false;

        // If the specifier is relative or absolute, and has an extension,
        // we don't need to resolve it
        if (
          importSpecifier.startsWith('.') ||
          importSpecifier.startsWith('/')
        ) {
          if (path.extname(importSpecifier) === '') {
            // If we don't have an extension, we need to resolve it, but fix the
            // resolved path to be relative to the current file
            relativeImport = importSpecifier.startsWith('.');
            absoluteImport = importSpecifier.startsWith('/');
            resolve = true;
          }
        } else {
          // If the import is not relative or absolute, we need to resolve it
          // using the resolver
          resolve = true;
        }

        const hasAttributes = assert !== -1;
        let attributes: Map<string, string> | undefined;
        if (cssModules && hasAttributes) {
          const attributesSource = source.slice(assert, importEnd);
          attributes = parseImportAttributes(attributesSource);

          if (attributes.get('type') === 'css') {
            cssImportTransform = true;
          }
        }

        if (!resolve && !cssImportTransform) {
          output += `${source.substring(lastIndex, start)}${importSpecifier}`;
          lastIndex = specifierEnd;
          continue;
        }

        const fileURL = new URL(filePath, 'file://');
        if (absoluteImport) {
          // If the import is absolute, we need to resolve it relative to the
          // base path
          importSpecifier = path.join(base, importSpecifier);
        }
        const resolveFromPath = path.dirname(filePath);
        const resolvedImportURL = await new Promise<URL>((res, rej) => {
          resolver.resolve(
            {},
            resolveFromPath,
            importSpecifier,
            {},
            (err, result) => {
              if (err) {
                rej(err);
              } else if (result === undefined || result === false) {
                rej(new Error('Could not resolve import'));
              } else {
                res(new URL(result, fileURL));
              }
            },
          );
        });
        const resolvedImportPath = resolvedImportURL.pathname;

        if (!resolvedImportPath.startsWith(root)) {
          throw new HttpError(
            500,
            undefined,
            `Attempted to resolve import outside of root:\n  root: ${root}\n  resolved: ${resolvedImportPath}`,
          );
        }

        let resolvedImport: string;

        if (relativeImport) {
          // For relative imports, we resolve the path relative to the current
          // file. This keeps the rewritten import as similar as possible to the
          // original import. Most likely in this case we're just adding a file
          // extension.
          resolvedImport = path.relative(
            path.dirname(filePath),
            resolvedImportPath,
          );
          if (!resolvedImport.startsWith('.')) {
            resolvedImport = './' + resolvedImport;
          }
        } else if (resolvedImportPath.startsWith(base)) {
          // Imports within the base path are rewritten to be relative to the
          // mounted path.
          resolvedImport = resolvedImportPath.substring(base.length);
        } else {
          resolvedImport = path.join(
            mountPrefix,
            rootPathPrefix,
            resolvedImportPath.substring(root.length),
          );
        }

        if (cssImportTransform) {
          attributes?.delete('type');
          let attributesSource = '';
          if (attributes?.size) {
            const attrs = Array.from(attributes.entries())
              .map(([key, value]) => `${key}: '${value}'`)
              .join(', ');
            attributesSource = ` with {${attrs}}`;
          }
          output +=
            source.substring(lastIndex, start) +
            resolvedImport +
            '?type=css-module' +
            source.substring(specifierEnd, specifierEnd + 1) +
            attributesSource;
          lastIndex = importEnd;
        } else {
          output += source.substring(lastIndex, start) + resolvedImport;
          lastIndex = specifierEnd;
        }
      }
    }

    res.type = 'text/javascript';
    res.body = output + source.substring(lastIndex);
  };
};
