import compressible from 'compressible';
import {type Middleware, HTMLPartial, pipeToWritable} from '@zipadee/core';
import {Stream} from 'node:stream';
import {
  gzipSync,
  deflateSync,
  brotliCompressSync,
  type ZlibOptions,
  type BrotliOptions,
} from 'node:zlib';
import {
  getPreferredEncoding,
  encodingMethods,
  encodingMethodDefaultOptions,
  preferredEncodings as defaultPreferredEncodings,
  type EncodingName,
} from './lib/encodings.js';

/**
 * Regex to match no-transform directive in a cache-control header
 */
const NO_TRANSFORM_REGEX = /(?:^|,)\s*?no-transform\s*?(?:,|$)/;

/**
 * Empty body status codes that should not be compressed
 */
const emptyBodyStatuses = new Set([204, 205, 304]);

/**
 * Filter function to determine if a content type should be compressed
 */
export type FilterFunction = (contentType: string) => boolean;

/**
 * Encoding options can be an object of zlib/brotli options, false to disable,
 * or a function that returns options or false
 */
export type EncodingOptions = ZlibOptions | BrotliOptions | false | null;

/**
 * Compression middleware options
 */
export interface CompressOptions {
  /**
   * Filter function to determine if content should be compressed.
   * Defaults to the compressible module which checks MIME types.
   */
  filter?: FilterFunction;

  /**
   * Minimum response size in bytes to compress.
   * Default: 1024
   */
  threshold?: number;

  /**
   * Default encoding to use when no Accept-Encoding header is present.
   * Default: 'identity' (no compression)
   * Set to '*' to enable compression by default.
   */
  defaultEncoding?: EncodingName | 'identity' | '*';

  /**
   * Options for gzip compression.
   * Set to false to disable gzip.
   */
  gzip?: EncodingOptions;

  /**
   * Options for deflate compression.
   * Set to false to disable deflate.
   */
  deflate?: EncodingOptions;

  /**
   * Options for Brotli compression.
   * Set to false to disable Brotli.
   */
  br?: EncodingOptions;
}

/**
 * Create compression middleware for Zipadee
 *
 * @param options Compression options
 * @returns Middleware function
 *
 * @example
 * ```ts
 * import {compress} from '@zipadee/compress';
 *
 * app.use(compress({
 *   threshold: 1024,
 *   br: false, // disable brotli
 * }));
 * ```
 */
export function compress(options: CompressOptions = {}): Middleware {
  const {
    filter = compressible,
    defaultEncoding = 'identity',
    threshold = 1024,
  } = options;

  // Determine which encodings are enabled
  const preferredEncodings = defaultPreferredEncodings.filter(
    (encoding: EncodingName) => {
      const opt = options[encoding as keyof CompressOptions];
      return opt !== false && opt !== null;
    },
  );

  // Build encoding options for each enabled encoding
  const encodingOptions: Partial<
    Record<EncodingName, ZlibOptions | BrotliOptions>
  > = {};
  preferredEncodings.forEach((encoding: EncodingName) => {
    const opt = options[encoding as keyof CompressOptions];
    encodingOptions[encoding] = {
      ...encodingMethodDefaultOptions[encoding],
      ...(typeof opt === 'object' ? opt : {}),
    } as ZlibOptions | BrotliOptions;
  });

  return async (req, res, next) => {
    // Let downstream middleware set the response body
    await next();

    // Add Vary: Accept-Encoding header
    const vary = res.getHeader('Vary');
    if (!vary) {
      res.setHeader('Vary', 'Accept-Encoding');
    } else {
      const varyValue = Array.isArray(vary) ? vary.join(', ') : String(vary);
      if (!varyValue.includes('Accept-Encoding')) {
        res.setHeader('Vary', `${varyValue}, Accept-Encoding`);
      }
    }

    const {body} = res;
    let type = res.type;
    const size = res.length;

    // If body is HTMLPartial and Content-Type isn't set yet, treat it as text/html
    if (body instanceof HTMLPartial && type === undefined) {
      type = 'text/html';
    }

    // Early exit conditions
    if (
      // No body to compress
      body === undefined ||
      // Headers already sent
      res.headersSent ||
      // HEAD request
      req.method === 'HEAD' ||
      // Empty body status codes
      emptyBodyStatuses.has(res.statusCode) ||
      // Already encoded
      res.hasHeader('Content-Encoding') ||
      // Not a compressible type
      !(type !== undefined && filter(type)) ||
      // Cache-Control: no-transform
      // TODO (justinfagnani): should an origin server like this really
      // honor no-transform?
      NO_TRANSFORM_REGEX.test(res.getSingleHeader('Cache-Control') ?? '')
    ) {
      return;
    }

    // Check threshold
    if (threshold && size !== undefined && size < threshold) {
      return;
    }

    // Determine preferred encoding
    const acceptEncoding = req.getSingleHeader('Accept-Encoding');
    const encodingToParse = acceptEncoding ?? defaultEncoding;
    const encoding = getPreferredEncoding(encodingToParse, {
      preferredEncodings,
    });

    // identity === no compression
    if (encoding === 'identity') {
      return;
    }

    /** Begin compression logic **/

    // Set encoding header
    res.setHeader('Content-Encoding', encoding);
    res.removeHeader('Content-Length');

    // Handle different body types
    if (body instanceof Stream) {
      // For streams, pipe them through a compression stream
      const compressor = encodingMethods[encoding as EncodingName];
      const compressionStream = compressor(
        encodingOptions[encoding as EncodingName],
      );
      body.pipe(compressionStream);
      res.body = compressionStream;
    } else if (body instanceof HTMLPartial) {
      // For HTMLPartial, pipe it directly into the compression stream

      // Set Content-Type before replacing body to preserve it
      if (!res.hasHeader('Content-Type')) {
        res.type = 'html';
      }
      const compressor = encodingMethods[encoding as EncodingName];
      const compressionStream = compressor(
        encodingOptions[encoding as EncodingName],
      );
      res.body = compressionStream;

      // Start piping the HTMLPartial to the compression stream
      // This runs asynchronously but we don't await it - it will stream
      pipeToWritable(body, compressionStream).then(
        () => compressionStream.end(),
        (err) => compressionStream.destroy(err),
      );
    } else {
      // For string/buffer/JSON, compress synchronously and set as Buffer
      let bodyBuffer: Buffer;
      if (typeof body === 'string') {
        bodyBuffer = Buffer.from(body);
      } else {
        bodyBuffer = body as Buffer;
      }

      // Compress synchronously based on encoding
      let compressed: Buffer;
      const opts = encodingOptions[encoding as EncodingName];
      if (encoding === 'gzip') {
        compressed = gzipSync(bodyBuffer, opts as ZlibOptions);
      } else if (encoding === 'deflate') {
        compressed = deflateSync(bodyBuffer, opts as ZlibOptions);
      } else if (encoding === 'br') {
        compressed = brotliCompressSync(bodyBuffer, opts as BrotliOptions);
      } else {
        // Fallback (should never happen)
        compressed = bodyBuffer;
      }

      res.body = compressed;
    }
  };
}
