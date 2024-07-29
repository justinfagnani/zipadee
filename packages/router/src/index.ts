import type {
  HttpMethod,
  Middleware,
  NextFunction,
  Request,
  Response,
} from '@zipadee/core';
import {URLPattern} from 'urlpattern-polyfill';

interface RouteInfo {
  method: HttpMethod;
  pattern: string;
  middleware: RouterMiddleware;
}

export type RouterMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
  params: URLPatternResult,
) => void;

export class Router {
  #routes: Array<RouteInfo> = [];

  get(pattern: string, middleware: RouterMiddleware): void {
    this.#routes.push({method: 'GET', pattern, middleware});
  }

  post(pattern: string, middleware: RouterMiddleware): void {
    this.#routes.push({method: 'POST', pattern, middleware});
  }

  routes(): Middleware {
    return async (req, res, next) => {
      const {path, method, origin} = req;
      for (const route of this.#routes) {
        // TODO: cache the URLPattern instance, or use a fake origin when
        // constructing and testing the pattern
        const urlPattern = new URLPattern(route.pattern, origin);
        if (route.method === method && urlPattern.test(path, origin)) {
          const params = urlPattern.exec(path, origin);
          await route.middleware(req, res, next, params!);
          return;
        }
      }
      return next();
    };
  }
}
