import type {IncomingMessage} from 'node:http';
import accepts from 'accepts';
import type Cookies from 'cookies';
import type {TLSSocket} from 'node:tls';

export type HttpMethod =
  | 'GET'
  | 'HEAD'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'OPTIONS'
  | 'TRACE'
  | 'CONNECT';

export class Request {
  #req: IncomingMessage;
  #accepts?: ReturnType<typeof accepts>;
  #cookies: Cookies;
  #trustProxy: boolean;
  #url?: URL;

  // A path that can be set by middleware to override the URL path.
  #path?: string;

  get baseRequest() {
    return this.#req;
  }

  constructor(req: IncomingMessage, cookies: Cookies, trustProxy: boolean) {
    this.#req = req;
    this.#cookies = cookies;
    this.#trustProxy = trustProxy;
  }

  getHeader(name: string) {
    return this.#req.headers[name.toLowerCase()];
  }

  /**
   * Gets the first value of the HTTP header with the given name. If that header
   * is not set, the returned value will be `undefined`.
   */
  getSingleHeader(name: string) {
    const header = this.getHeader(name);
    if (header === undefined) {
      return undefined;
    }
    if (Array.isArray(header)) {
      return header[0];
    }
    return typeof header === 'string' ? header : String(header);
  }

  hasHeader(name: string) {
    return this.getHeader(name) !== undefined;
  }

  get accepts() {
    return (this.#accepts ??= accepts(this.#req));
  }

  get cookies() {
    return this.#cookies;
  }

  get method() {
    return this.#req.method;
  }

  /**
   * The origin of the request URL.
   */
  get origin() {
    return `${this.protocol}://${this.host}`;
  }

  /**
   * The protocol of the request URL: "http" or "https".
   *
   * When the `trustProxy` setting is enabled the X-Forwarded-Proto header will
   * be used.
   */
  get protocol() {
    // When the protocol is https, the socket will be a TLSSocket
    // https://nodejs.org/api/tls.html#tlssocketencrypted
    if ((this.#req.socket as TLSSocket).encrypted) {
      return 'https';
    }
    if (this.#trustProxy && this.getHeader('X-Forwarded-Proto')) {
      return this.getSingleHeader('X-Forwarded-Proto');
    }
    return 'http';
  }

  /**
   * The Host header, or X-Forwarded-Host header when proxies are trusted.
   */
  get host() {
    if (this.#trustProxy && this.getHeader('X-Forwarded-Host')) {
      return this.getSingleHeader('X-Forwarded-Host');
    }
    return this.getSingleHeader('Host');
  }

  get url() {
    if (this.#req.url === undefined) {
      return undefined;
    }
    this.#url = new URL(this.#req.url, this.origin);
    return this.#url;
  }

  get path(): string {
    return this.#path ?? this.url?.pathname ?? '/';
  }

  set path(value: string | undefined) {
    this.#path = value;
  }
}
