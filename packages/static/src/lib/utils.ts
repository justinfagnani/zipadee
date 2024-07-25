/**
 * Module dependencies.
 */
import asyncFs from 'node:fs/promises';
import path from 'node:path';
import {join, normalize, resolve, sep, isAbsolute} from 'node:path';

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
  let path = relativePath;
  let root = rootPath;

  if (typeof root !== 'string') {
    throw new TypeError('rootPath must be a string');
  }

  if (typeof path !== 'string') {
    throw new TypeError('relativePath must be a string');
  }

  // Paths cannot contain NULL bytes
  if (path.indexOf('\0') !== -1) {
    throw new Error('Malicious Path');
  }

  // relativePath must not be absolute.
  // TODO: change this to make absolute paths relative to root?
  if (isAbsolute(path)) {
    throw new Error('Malicious Path');
  }

  // relativePath must not traverse above root
  if (UP_PATH_REGEXP.test(normalize('.' + sep + path))) {
    throw new Error('Malicious Path');
  }

  // join the relative path
  return normalize(join(resolve(root), path));
};
