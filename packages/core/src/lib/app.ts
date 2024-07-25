import * as http from 'node:http';
import type {IncomingMessage, ServerResponse} from 'node:http';
import {type Middleware, compose} from './middleware.js';
import {Response} from './response.js';
import {Request} from './request.js';
import Cookies from 'cookies';
import {HttpError} from './http-error.js';

export interface Options {
  trustProxy?: boolean;
  cookies?: Cookies.Option;
}

export class App {
  #server: http.Server;
  get server() {
    return this.#server;
  }

  #middleware: Middleware[] = [];

  #trustProxy: boolean;
  #cookiesOptions: Cookies.Option | undefined;

  constructor(options?: Options) {
    this.#server = http.createServer(this.#callback);
    this.#trustProxy = options?.trustProxy ?? false;
    this.#cookiesOptions = options?.cookies;
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
      await composedMiddleware(request, response, async () => {});
      await response.respond();
    } catch (e: unknown) {
      console.error(e);
      if (e instanceof HttpError) {
        response.baseResponse.statusCode = e.status;
        response.body = e.message;
      } else {
        response.baseResponse.statusCode = 500;
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
