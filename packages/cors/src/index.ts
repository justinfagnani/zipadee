import type {Middleware, Request} from '@zipadee/core';

export type Origin =
  | string
  | ((request: Request) => string | false | Promise<string | false>);

export interface CorsOptions {
  origin?: Origin;
  allowMethods?: string | Array<string> | null;
  allowHeaders?: string | Array<string>;
  secureContext?: boolean;
  exposeHeaders?: string | Array<string>;
  maxAge?: string | number;
  credentials?: boolean | ((request: Request) => boolean | Promise<boolean>);
  keepHeadersOnError?: boolean;
}

interface NormalizedOptions {
  origin: Origin;
  allowMethods?: string | null;
  allowHeaders?: string;
  secureContext?: boolean;
  exposeHeaders?: string;
  maxAge?: string;
  credentials?: boolean | ((request: Request) => boolean | Promise<boolean>);
  keepHeadersOnError?: boolean;
}

const defaultOptions: NormalizedOptions = {
  origin: '*',
  allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH',
  secureContext: false,
};

const normalizeOptions = (options: CorsOptions): NormalizedOptions => {
  const normalizedOptions: NormalizedOptions = {
    origin: options.origin ?? defaultOptions.origin,
    secureContext: options.secureContext ?? defaultOptions.secureContext,
    maxAge:
      options.maxAge === undefined
        ? defaultOptions.maxAge
        : String(options.maxAge),
    credentials: options.credentials ?? defaultOptions.credentials,
    keepHeadersOnError: options.keepHeadersOnError ?? false,
  };

  if (Array.isArray(options.allowMethods)) {
    normalizedOptions.allowMethods = options.allowMethods.join(',');
  } else {
    normalizedOptions.allowMethods =
      options.allowMethods ?? defaultOptions.allowMethods;
  }

  if (Array.isArray(options.exposeHeaders)) {
    normalizedOptions.exposeHeaders = options.exposeHeaders.join(',');
  } else if (options.exposeHeaders !== undefined) {
    normalizedOptions.exposeHeaders = options.exposeHeaders;
  }

  if (Array.isArray(options.allowHeaders)) {
    normalizedOptions.allowHeaders = options.allowHeaders.join(',');
  } else if (options.allowHeaders !== undefined) {
    normalizedOptions.allowHeaders = options.allowHeaders;
  }

  return normalizedOptions;
};

/**
 *
 * @param userOptions
 * @returns
 */
export const cors = (userOptions: CorsOptions = {}): Middleware => {
  const options = normalizeOptions(userOptions);

  if (Array.isArray(options.exposeHeaders)) {
    options.exposeHeaders = options.exposeHeaders.join(',');
  }

  return async (req, res, next) => {
    let origin: string | false;
    if (typeof options.origin === 'function') {
      origin = await options.origin(req);
    } else {
      origin = options.origin ?? '*';
    }

    let credentials: boolean;
    if (typeof options.credentials === 'function') {
      credentials = await options.credentials(req);
    } else {
      credentials = !!options.credentials;
    }

    const requestOrigin = req.getSingleHeader('Origin');

    if (requestOrigin === undefined) {
      // If the Origin header is not present, we can only respond with
      // `Access-Control-Allow-Origin: *`, and only if the origin option is '*'.
      // and credentials is false.

      if (credentials === true) {
        // This isn't a valid request, so we're going to ignore it.
        return await next();
      }

      if (origin === '*') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return await next();
      }
    }

    if (credentials && origin === '*') {
      // koa-cors sets the Access-Control-Allow-Origin header to the request
      // origin if the credentials option is true. This would allow requests
      // from any origin with credentials. This doesn't seem like the intention
      // of the spec, so we're not going to replicate this behavior.

      // This isn't a valid request + config, so we're going to ignore it.
      return await next();
    }

    if (origin === false) {
      // If the origin option is `false`, then do not set any CORS headers.
      return await next();
    }

    if (req.method === 'OPTIONS') {
      // Preflight request

      // If there is no Access-Control-Request-Method header this isn't a valid
      // preflight request.
      if (!req.hasHeader('Access-Control-Request-Method')) {
        return await next();
      }

      res.setHeader('Access-Control-Allow-Origin', origin);
      res.statusCode = 204;

      if (options.allowMethods) {
        res.setHeader('Access-Control-Allow-Methods', options.allowMethods);
      }

      if (credentials === true) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      if (options.secureContext) {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      }

      if (options.maxAge) {
        res.setHeader('Access-Control-Max-Age', options.maxAge);
      }

      if (options.allowMethods) {
        res.setHeader('Access-Control-Allow-Methods', options.allowMethods);
      }

      let allowHeaders = options.allowHeaders;
      if (allowHeaders === undefined) {
        allowHeaders = req.getSingleHeader('Access-Control-Request-Headers');
      }
      if (allowHeaders) {
        res.setHeader('Access-Control-Allow-Headers', allowHeaders);
      }
      return;
    } else {
      if (origin === '*') {
        res.setHeader('Access-Control-Allow-Origin', '*');
      } else {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }

      if (options.exposeHeaders) {
        res.setHeader('Access-Control-Expose-Headers', options.exposeHeaders);
      }

      if (credentials === true) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      if (options.secureContext) {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      }

      // koa-cors wraps the next() call in a try/catch block and tries to
      // remove the headers set in this middleware if an error is thrown.
      // This isn't always possible if the headers have already been sent. Is it
      // worth trying to replicate this behavior?
      return await next();
    }
  };
};
