import * as http from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { type Middleware, compose } from './middleware.js';
import { Response } from './response.js';
import { Request } from './request.js';
import Cookies from 'cookies';
import { HttpError } from './http-error.js';

export interface Options {

  /**
   * If true, trust the X-Forwarded-* headers for proxying. Defaults to false.
   */
  trustProxy?: boolean;

  /**
   * Options for the cookies module. See
   * https://github.com/pillarjs/cookies?tab=readme-ov-file#new-cookiesrequest-response--options
   */
  cookies?: Cookies.Option;

  /**
   * If true, show error stack traces and private messages in responses for
   * debugging (default: false)
   */
  dev?: boolean;
}

export class App {
  #server: http.Server;
  get server() {
    return this.#server;
  }

  #middleware: Middleware[] = [];

  #trustProxy: boolean;
  #cookiesOptions: Cookies.Option | undefined;
  #devMode: boolean;
  constructor(options?: Options) {
    this.#server = http.createServer(this.#callback);
    this.#trustProxy = options?.trustProxy ?? false;
    this.#cookiesOptions = options?.cookies;
    this.#devMode = options?.dev ?? false;
  }

  #callback: http.RequestListener = async (
    req: IncomingMessage,
    res: ServerResponse,
  ) => {
    const cookies = new Cookies(req, res, this.#cookiesOptions);
    const request = new Request(req, cookies, this.#trustProxy);
    const response = new Response(res, request);
    const composedMiddleware = compose(...this.#middleware);
    try {
      await composedMiddleware(request, response, async () => { });
      await response.respond();
    } catch (e: unknown) {
      if (e instanceof HttpError) {
        response.baseResponse.statusCode = e.status;
        response.baseResponse.write(e.message);
        if (this.#devMode) {
          if (e.privateMessage !== undefined) {
            response.baseResponse.write(`\n${e.privateMessage}`);
          }
          if (e.stack !== undefined) {
            response.baseResponse.write(`\n${e.stack}`);
          }
        }
        if (e.status >= 500) {
          console.error(`[HttpError] ${e.status}: ${e.privateMessage}`);
          if (e.stack !== undefined) {
            console.error(e.stack);
          }
        }
      } else {
        console.error(e);
        if (e instanceof Error && e.stack !== undefined) {
          console.error(e.stack);
        }
        response.baseResponse.statusCode = 500;
        if (this.#devMode && e instanceof Error) {
          response.baseResponse.setHeader('Content-Type', 'text/plain; charset=utf-8');
          response.baseResponse.write(
            `Internal Server Error\n\n${e.message}\n\n${e.stack}`
          );
        }
      }
    }
    response.baseResponse.end();
  };

  listen(port?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Handle errors that occur while starting the server
      const errorListener = (e: Error) => {
        this.#server.removeListener('error', errorListener);
        this.#server.close();
        reject(e);
      };
      this.#server.on('error', errorListener);
      this.#server.listen(port, () => {
        this.#server.removeListener('error', errorListener);
        resolve();
      });
    });
  }

  use(middleware: Middleware) {
    this.#middleware.push(middleware);
  }

  [Symbol.dispose]() {
    this.close();
  }

  close() {
    this.#server.close();
  }
}
