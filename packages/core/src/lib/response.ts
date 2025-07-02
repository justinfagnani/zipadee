import {type ServerResponse, STATUS_CODES} from 'node:http';
import {getType} from 'cache-content-type';
import type {Request} from './request.js';
import {Stream} from 'stream';
import {HTMLPartial, type RenderValue} from './html.js';
import {ReadableStream} from 'node:stream/web';
import {Readable, Duplex} from 'node:stream';

export class Response {
  static readonly BACK = Symbol('Response.BACK');

  #res: ServerResponse;
  #req: Request;

  #body?:
    | string
    | Buffer
    | Uint8Array
    | HTMLPartial
    | Readable
    | Duplex
    | ReadableStream;

  #statusCodeSet = false;

  get baseResponse() {
    return this.#res;
  }

  constructor(res: ServerResponse, req: Request) {
    this.#res = res;
    this.#req = req;
    // TODO: make this configurable - it could be 500
    this.statusCode = 404;
    this.#statusCodeSet = false;
  }

  get body() {
    return this.#body;
  }

  set body(
    value:
      | undefined
      | string
      | Buffer
      | Uint8Array
      | HTMLPartial
      | Readable
      | Duplex
      | ReadableStream,
  ) {
    // TODO: only do this if the status was not set by middleware
    if (!this.#statusCodeSet) {
      this.statusCode = 200;
    }
    this.#body = value;
  }

  // TODO: make this a private method
  async respond() {
    const value = this.#body;
    if (typeof value === 'string') {
      if (!this.hasHeader('Content-Type')) {
        this.type = 'text';
      }
      this.length = Buffer.byteLength(value);
      this.#res.end(value);
      return;
    }

    if (value instanceof HTMLPartial) {
      if (!this.hasHeader('Content-Type')) {
        this.type = 'html';
      }

      const writeResult = async (
        result: Iterable<RenderValue>,
      ): Promise<void> => {
        // TODO: Should we cork the response until we see a Promise?
        for (const chunk of result) {
          if (typeof chunk === 'string') {
            this.#res.write(chunk);
          } else {
            const v = await chunk;
            if (typeof v === 'string') {
              this.#res.write(v);
            } else {
              await writeResult(v);
            }
          }
        }
      };

      await writeResult(value);
      // const text = value.toString();
      // this.length = Buffer.byteLength(text);
      this.#res.end();
      return;
    }

    if (Buffer.isBuffer(value)) {
      if (!this.hasHeader('Content-Type')) {
        this.type = 'bin';
      }
      this.length = value.length;
      this.#res.end(value);
      return;
    }

    if (value instanceof ReadableStream) {
      Readable.fromWeb(value).pipe(this.#res);
      await new Promise<void>((resolve) => {
        this.#res.once('end', resolve);
      });
      return;
    }

    if (value instanceof Readable || value instanceof Duplex) {
      value.pipe(this.#res);
      await new Promise<void>((resolve) => {
        this.#res.once('end', resolve);
      });
      return;
    }

    this.#res.end(value);
  }

  write(value: string | Buffer | Uint8Array) {
    this.#res.write(value);
  }

  end(value?: string | Buffer | Uint8Array) {
    this.#res.end(value);
  }

  /**
   * The response status code.
   */
  get statusCode() {
    return this.#res.statusCode;
  }

  set statusCode(value: number) {
    this.#statusCodeSet = true;
    this.#res.statusCode = value;
    if (this.#res.statusMessage === undefined && STATUS_CODES[value]) {
      this.#res.statusMessage = STATUS_CODES[value];
    }
  }

  get statusMessage() {
    // Note the cast because the Node.js typings are incorrect
    return this.#res.statusMessage as string | undefined;
  }

  set statusMessage(value: string | undefined) {
    // Note the cast because the Node.js typings are incorrect
    this.#res.statusMessage = value as string;
  }

  /**
   * Perform redirect to `url`. `url` can be a string, a URL object, or the
   * symbol `Response.BACK`. If `url` is a string, it is parsed with
   * `new URL(url, req.url)`.
   *
   * The symbol `Response.BACK` redirects to the Referer request header. If the
   * Referer header is not present, the given `alt` value is used, or `'/'` if
   * `alt` is not provided.
   */
  redirect(url: string | URL | typeof Response.BACK, alt: string | URL = '/') {
    if (url === Response.BACK) {
      url = this.#req.getSingleHeader('Referer') ?? alt;
    }
    if (
      typeof url === 'string' &&
      (url.startsWith('./') || url.startsWith('../'))
    ) {
      url = new URL(url, this.#req.url);
    }
    this.setHeader('Location', url.toString());

    if (!(this.#res.statusCode >= 300 && this.#res.statusCode < 400)) {
      this.statusCode = 302;
    }

    if (this.#req.accepts.type('html')) {
      this.type = 'text/html; charset=utf-8';
      this.body = `Redirecting to <a href="${url}">${url}</a>.`;
    } else {
      this.type = 'text/plain; charset=utf-8';
      this.body = `Redirecting to ${url}.`;
    }
  }

  get cookies() {
    return this.#req.cookies;
  }

  hasHeader(name: string) {
    return this.#res.hasHeader(name);
  }

  getHeader(name: string) {
    return this.#res.getHeader(name);
  }

  /**
   * Gets the first value of the HTTP header with the given name. If that header
   * is not set, the returned value will be `undefined`.
   */
  getSingleHeader(name: string) {
    const header = this.#res.getHeader(name);
    if (header === undefined) {
      return undefined;
    }
    if (Array.isArray(header)) {
      return header[0];
    }
    return typeof header === 'string' ? header : String(header);
  }

  setHeader(name: string, value: string | string[]) {
    this.#res.setHeader(name, value);
  }

  appendHeader(name: string, value: string | string[]) {
    this.#res.appendHeader(name, value);
  }

  removeHeader(name: string) {
    this.#res.removeHeader(name);
  }

  get headersSent() {
    return this.#res.headersSent;
  }

  flushHeaders() {
    this.#res.flushHeaders();
  }

  /**
   * The value of the Content-Type header.
   */
  get type() {
    return this.getSingleHeader('Content-Type');
  }

  set type(value: string | undefined) {
    if (value === undefined) {
      this.removeHeader('Content-Type');
      return;
    }
    const type = getType(value);
    if (type !== false) {
      this.setHeader('Content-Type', type);
    } else {
      this.removeHeader('Content-Type');
    }
  }

  /**
   * The Content-Length header when present.
   */
  get length() {
    if (this.hasHeader('Content-Length')) {
      return parseInt(this.getSingleHeader('Content-Length')!, 10) ?? 0;
    }

    if (!this.body || this.body instanceof Stream) {
      return undefined;
    }
    if (typeof this.body === 'string') {
      return Buffer.byteLength(this.body);
    }
    if (Buffer.isBuffer(this.body)) {
      return this.body.length;
    }
    return Buffer.byteLength(JSON.stringify(this.body));
  }

  set length(n: number | undefined) {
    if (!this.hasHeader('Transfer-Encoding')) {
      this.setHeader('Content-Length', String(n));
    }
  }

  /**
   * The value of the Last-Modified header as a Date object.
   */
  get lastModified() {
    const date = this.getSingleHeader('Last-Modified');
    if (date === undefined) {
      return undefined;
    }
    return new Date(date);
  }

  set lastModified(value: string | Date | undefined) {
    if (value === undefined) {
      this.removeHeader('Last-Modified');
      return;
    }
    if (typeof value === 'string') {
      value = new Date(value);
    }
    this.setHeader('Last-Modified', value.toUTCString());
  }

  /**
   * The value of the ETag header.
   *
   * ETag is a string that uniquely identifies the current version of the
   * resource. ETags values must have the following format:
   *
   *   W/"<etag_value>"
   *   "<etag_value>"
   *
   * Since the ETag value must be quoted, double-quotes will be added if
   * necessary when setting the value. When double-quotes are added,
   * quotes within the value will be escaped.
   */
  get etag() {
    return this.getSingleHeader('ETag');
  }

  set etag(value: string | undefined) {
    if (value === undefined) {
      this.removeHeader('ETag');
      return;
    }
    if (!/^(W\/)?"/.test(value)) {
      value = `"${value.replaceAll('"', '\\"')}"`;
    }
    this.setHeader('ETag', value);
  }
}
