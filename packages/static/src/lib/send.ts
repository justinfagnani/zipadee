import {HttpError, type Request, type Response} from '@zipadee/core';
import type {Stats} from 'node:fs';
import {default as asyncFs, default as fs} from 'node:fs/promises';
import path from 'node:path';
import {
  getFileType,
  pathExists,
  pathIsHidden,
  resolvePath as safeResolvePath,
} from './utils.js';

// Originally ported from https://github.com/koajs/send/blob/master/src/send.ts

type SetHeaders = (res: Response, path: string, stats: Stats) => void;

export interface SendOptions {
  /**
   * Root directory to restrict file access.
   */
  root?: string;
  /**
   * Name of the index file to serve automatically when visiting the root location. (defaults to none).
   */
  index?: string | false;
  /**
   * Browser cache max-age in milliseconds. (defaults to `0`).
   */
  maxage?: number;
  maxAge?: SendOptions['maxage'];
  /**
   * Tell the browser the resource is immutable and can be cached indefinitely. (defaults to false)
   */
  immutable?: boolean;
  /**
   * Allow transfer of hidden files. (defaults to false)
   */
  hidden?: boolean;
  /**
   * Try to serve the gzipped version of a file automatically when gzip is supported by a client and if the requested file with .gz extension exists. (defaults to true).
   */
  gzip?: boolean;
  /**
   * Try to serve the brotli version of a file automatically when brotli is supported by a client and if the requested file with .br extension exists. (defaults to true).
   */
  brotli?: boolean;
  /**
   * If not false (defaults to true), format the path to serve static file servers and not require a trailing slash for directories, so that you can do both /directory and /directory/.
   */
  format?: boolean;
  /**
   * Function to set custom headers on response.
   */
  setHeaders?: SetHeaders;
  /**
   * Try to match extensions from passed array to search for file when no extension is sufficed in URL. First found is served. (defaults to false)
   */
  extensions?: string[] | false;
};

/**
 * Send the file at `path` with the given `options` to the Response.
 */
export const send = async (
  req: Request,
  res: Response,
  filePath: string,
  opts: SendOptions = {},
): Promise<string | undefined> => {
  // options
  const root = opts.root ? path.resolve(opts.root) : '';
  const trailingSlash = filePath.at(-1) === '/';
  filePath = filePath.slice(path.parse(filePath).root.length);
  const {index} = opts;
  const maxage = opts.maxage || opts.maxAge || 0;
  const immutable = opts.immutable || false;
  const hidden = opts.hidden || false;
  const format = opts.format !== false;
  const extensions = Array.isArray(opts.extensions) ? opts.extensions : false;
  const brotli = opts.brotli !== false;
  const gzip = opts.gzip !== false;
  const {setHeaders} = opts;

  if (setHeaders !== undefined && typeof setHeaders !== 'function') {
    throw new TypeError('option setHeaders must be function');
  }

  // Normalize and decode path
  try {
    filePath = decodeURIComponent(filePath);
  } catch {
    res.statusCode = 400;
    res.statusMessage = 'Failed to decode path';
    return;
  }

  // Index file support
  if (index && trailingSlash) {
    filePath += index;
  }
  filePath = safeResolvePath(root, filePath);

  // Hidden file support, ignore
  if (!hidden && pathIsHidden(root, filePath)) {
    return;
  }

  // serve brotli file when possible otherwise gzipped file when possible
  let encodingExt = '';
  if (
    req.accepts.encodings('br', 'identity') === 'br' &&
    brotli &&
    (await pathExists(filePath + '.br'))
  ) {
    filePath += '.br';
    res.setHeader('Content-Encoding', 'br');
    res.removeHeader('Content-Length');
    encodingExt = '.br';
  } else if (
    req.accepts.encodings('gzip', 'identity') === 'gzip' &&
    gzip &&
    (await pathExists(filePath + '.gz'))
  ) {
    filePath += '.gz';
    res.setHeader('Content-Encoding', 'gzip');
    res.removeHeader('Content-Length');
    encodingExt = '.gz';
  }

  if (extensions && !path.basename(filePath).includes('.')) {
    for (let ext of extensions) {
      if (typeof ext !== 'string') {
        throw new TypeError(
          'option extensions must be array of strings or false',
        );
      }
      if (!ext.startsWith('.')) {
        ext = `.${ext}`;
      }
      if (await pathExists(`${filePath}${ext}`)) {
        filePath = `${filePath}${ext}`;
        break;
      }
    }
  }

  // stat
  let stats;
  try {
    stats = await asyncFs.stat(filePath);
    // Format the path to serve static file servers
    // and not require a trailing slash for directories,
    // so that you can do both `/directory` and `/directory/`
    if (stats.isDirectory()) {
      if (!format || !index) {
        return;
      }
      filePath += `/${index}`;
      stats = await asyncFs.stat(filePath);
    }
  } catch (e) {
    const err = e as Error & {code: string};
    const notfound = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR'];

    if (notfound.includes(err.code)) {
      throw new HttpError(404);
    }
    // err.status = 500;
    throw new HttpError(500, 'Internal Server Error');
  }

  // inject headers
  setHeaders?.(res, filePath, stats);

  // stream
  res.setHeader('Content-Length', stats.size.toString());

  if (!res.hasHeader('Last-Modified')) {
    res.setHeader('Last-Modified', stats.mtime.toUTCString());
  }
  if (!res.hasHeader('Cache-Control')) {
    const directives = [`max-age=${(maxage / 1000) | 0}`];

    if (immutable) {
      directives.push('immutable');
    }
    res.setHeader('Cache-Control', directives.join(','));
  }

  if (!res.type) {
    res.type = getFileType(filePath, encodingExt);
  }
  const handle = await fs.open(filePath, 'r');
  res.body = handle.createReadStream();
  return filePath;
};
