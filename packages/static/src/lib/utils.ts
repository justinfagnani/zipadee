import {HttpError} from '@zipadee/core';
import asyncFs from 'node:fs/promises';
import path from 'node:path';
import {join, normalize, resolve, sep, isAbsolute} from 'node:path';

/**
 * Wraps `decodeURIComponent` and throws an HTTP 400 error if the decoding
 * fails.
 */
export const decodePath = (path: string) => {
  try {
    return decodeURIComponent(path);
  } catch {
    throw new HttpError(400, 'Failed to decode path');
  }
};

/**
 * Returns `true` if the path exists, `false` otherwise.
 */
export const pathExists = async (targetPath: string) => {
  try {
    await asyncFs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Calls `fs.stat` on `filePath` and returns the result. If `fs.stat` throws an
 * error with code `ENOENT`, `ENAMETOOLONG`, or `ENOTDIR`, it throws an HTTP 404
 * error. Otherwise, it throws an HTTP 500 error.
 */
export const stat = async (filePath: string) => {
  try {
    return await asyncFs.stat(filePath);
  } catch (e) {
    const err = e as Error & {code: string};
    const notfound = ['ENOENT', 'ENAMETOOLONG', 'ENOTDIR'];

    if (notfound.includes(err.code)) {
      throw new HttpError(404);
    }
    throw new HttpError(500, 'Internal Server Error');
  }
};

/**
 * Returns `true` if any filename part of the path starts with a dot.
 */
export const pathIsHidden = (root: string, targetPath: string) => {
  const pathParts = targetPath.slice(root.length).split(path.sep);
  return pathParts.some((part) => part.at(0) === '.');
};

export function getFileType(file: string, ext: string) {
  if (ext !== '') {
    return path.extname(path.basename(file, ext));
  }
  return path.extname(file);
}

const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/**
 * Resolve `relativePath` against `root` path.
 */
export const resolvePath = (rootPath: string, relativePath: string) => {
  const path = relativePath;
  const root = rootPath;

  if (typeof root !== 'string') {
    throw new TypeError('rootPath must be a string');
  }

  if (typeof path !== 'string') {
    throw new TypeError('relativePath must be a string');
  }

  // Paths cannot contain NULL bytes
  if (path.indexOf('\0') !== -1) {
    throw new Error(`Malicious Path: ${path}`);
  }

  // relativePath must not be absolute.
  // TODO: change this to make absolute paths relative to root?
  if (isAbsolute(path)) {
    throw new Error(`Malicious Path: ${path}`);
  }

  // relativePath must not traverse above root
  if (UP_PATH_REGEXP.test(normalize('.' + sep + path))) {
    throw new Error(`Malicious Path: ${path}`);
  }

  // join the relative path
  return normalize(join(resolve(root), path));
};
