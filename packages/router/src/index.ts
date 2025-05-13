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
  pattern: URLPattern;
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

  get(pathname: string, middleware: RouterMiddleware): void {
    const urlPattern = new URLPattern({pathname});
    this.#routes.push({method: 'GET', pattern: urlPattern, middleware});
  }

  post(pathname: string, middleware: RouterMiddleware): void {
    const urlPattern = new URLPattern({pathname});
    this.#routes.push({method: 'POST', pattern: urlPattern, middleware});
  }

  routes(): Middleware {
    return async (req, res, next) => {
      const {path, method, origin} = req;
      for (const route of this.#routes) {
        if (route.method === method && route.pattern.test(path, origin)) {
          const params = route.pattern.exec(path, origin);
          await route.middleware(req, res, next, params!);
          return;
        }
      }
      return next();
    };
  }
}
