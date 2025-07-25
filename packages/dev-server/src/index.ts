import {App} from '@zipadee/core';
import {serve as serveJs} from '@zipadee/javascript';
import {serve} from '@zipadee/static';
import path from 'node:path';

/**
 * Options for the Zipadee dev server.
 */
export interface Options {
  /**
   * The port to listen on.
   */
  port: number;

  /**
   * The root directory to serve files from. The dev server will not serve files
   * outside this directory.
   */
  rootDir: string;

  /**
   * The base directory to serve from, as a relative path from the root
   * directory. Absolute paths will be resolved relative to this directory.
   *
   * If a JavaScript modules specifier resolves to outside of this directory, it
   * will be rewritten to be relative to the root directory.
   */
  baseDir?: string;

  /**
   * Whether to transform CSS modules to JavaScript. If true, CSS imports -
   * imports with a `type: 'css'` import attribute - will be transformed to
   * remove the `type: 'css'` attribute and add a `?type=css--module` query
   * parameter to the URL. Requests for these URLs will be served as JavaScript
   * modules that export the CSS as a CSSStyleSheet object.
   */
  cssModules?: boolean;
}

/**
 * Starts the Zipadee dev server.
 */
export const startServer = async ({
  port,
  rootDir,
  baseDir,
  cssModules,
}: Options) => {
  const app = new App();

  app.use(
    serveJs({
      root: rootDir,
      base: baseDir,
      conditions: ['browser', 'development', 'import'],
      cssModules,
    }),
  );

  const resolvedBaseDir = path.resolve(rootDir, baseDir ?? '');
  app.use(serve(resolvedBaseDir, {index: 'index.html'}));

  await app.listen(port);

  console.log(`Zipadee dev server is running on port ${port}`);
  console.log(`Serving files from ${resolvedBaseDir}`);
  console.log(`Press Ctrl+C to stop the server.`);
};
