import type {Response} from './response.js';
import type {Request} from './request.js';

export type NextFunction = () => Promise<void>;

export interface Middleware {
  (req: Request, res: Response, next: NextFunction): void;
}

export const compose = (...middleware: Array<Middleware>): Middleware => {
  return async (req: Request, res: Response, next: NextFunction) => {
    for (const fn of middleware.toReversed()) {
      const downstreamNext = next;
      let called = false;
      next = async () => {
        if (called) {
          throw new Error('next() called more than once');
        }
        called = true;
        await fn(req, res, downstreamNext);
      };
    }
    await next();
  };
};

export const mount = (prefix: string, middleware: Middleware): Middleware => {
  return async (req, res, next) => {
    const originalPath = req.path;
    const subpath = matchPath(prefix, originalPath);
    if (subpath !== false) {
      req.path = subpath;
      await middleware(req, res, async () => {
        req.path = originalPath;
        await next();
        req.path = subpath;
      });
      req.path = originalPath;
    } else {
      await next();
    }
  };
};

/**
 * Check if `path` starts with `prefix` and returns the new path.
 *
 * matchPath('/prefix/', '/asdf') => false
 * matchPath('/prefix', '/prefix') => /
 * matchPath('/prefix/', '/prefix') => false
 * matchPath('/prefix/', '/prefix/asdf') => /asdf
 * @internal
 */

const matchPath = (prefix: string, path: string) => {
  if (!path.startsWith(prefix)) {
    return false;
  }

  const subPath = path.substring(prefix.length);

  if (subPath === '') {
    return '/';
  }

  if (prefix.at(-1) === '/') {
    return '/' + subPath;
  }

  if (subPath[0] !== '/') {
    return false;
  }
  return subPath;
};
