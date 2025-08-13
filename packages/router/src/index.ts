import type {Middleware, NextFunction, Request, Response} from '@zipadee/core';
import {URLPattern} from 'urlpattern-polyfill';
import {URLPatternList, type URLPatternListMatch} from 'url-pattern-list';

export type RouterMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
  params: URLPatternResult,
) => void;

export class Router {
  #patternListGet: URLPatternList<RouterMiddleware>;
  #patternListPost: URLPatternList<RouterMiddleware>;

  constructor() {
    this.#patternListGet = new URLPatternList<RouterMiddleware>();
    this.#patternListPost = new URLPatternList<RouterMiddleware>();
  }

  get(pathname: string, middleware: RouterMiddleware): void {
    const urlPattern = new URLPattern({pathname});
    this.#patternListGet.addPattern(urlPattern, middleware);
  }

  post(pathname: string, middleware: RouterMiddleware): void {
    const urlPattern = new URLPattern({pathname});
    this.#patternListPost.addPattern(urlPattern, middleware);
  }

  routes(): Middleware {
    return async (req, res, next) => {
      const {path, method, origin} = req;
      let matchedRoute: URLPatternListMatch<RouterMiddleware> | null = null;

      if (method === 'GET') {
        matchedRoute = this.#patternListGet.match(path, origin);
      } else if (method === 'POST') {
        matchedRoute = this.#patternListPost.match(path, origin);
      }

      if (matchedRoute) {
        await matchedRoute.value(req, res, next, matchedRoute.result);
        return;
      }

      return next();
    };
  }
}
