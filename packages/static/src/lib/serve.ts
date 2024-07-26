import path from 'node:path';
import {send, type SendOptions} from './send.js';
import {HttpError, type Middleware} from '@zipadee/core';

export interface ServeOptions extends SendOptions {}

/**
 * Serve static files from a `root` directory.
 */
export const serve = (root: string, opts: ServeOptions = {}): Middleware => {
  opts.root = path.resolve(root);
  opts.index = opts.index ?? 'index.html';

  return async function serve(req, res, next) {
    let done = false;

    if (req.method === 'HEAD' || req.method === 'GET') {
      try {
        done = !!(await send(req, res, req.path, opts));
      } catch (err: unknown) {
        if (err instanceof HttpError && err.status !== 404) {
          throw err;
        }
      }
    }

    if (!done) {
      await next();
    }
  };
};
