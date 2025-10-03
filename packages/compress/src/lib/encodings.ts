/**
 * @fileoverview
 *
 * Encoding methods and utilities for HTTP compression
 */

import {HttpError} from '@zipadee/core';
import type {Duplex} from 'node:stream';
import {
  type BrotliOptions,
  constants,
  createBrotliCompress,
  createDeflate,
  createGzip,
  type ZlibOptions,
} from 'node:zlib';

export const supportedEncodings = ['gzip', 'deflate', 'br'] as const;

/**
 * Encoding method names
 */
export type EncodingName = (typeof supportedEncodings)[number];

/**
 * Encoding factory function type
 */
export type EncodingFactory = (options?: ZlibOptions | BrotliOptions) => Duplex;

/**
 * Map of encoding names to their factory functions
 */
export const encodingMethods: Record<EncodingName, EncodingFactory> = {
  gzip: createGzip,
  deflate: createDeflate,
  br: createBrotliCompress,
};

/**
 * Default options for each encoding method
 */
export const encodingMethodDefaultOptions: Record<
  EncodingName,
  ZlibOptions | BrotliOptions
> = {
  gzip: {},
  deflate: {},
  br: {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 4,
    },
  },
};

/**
 * How we treat `Accept-Encoding: *`
 */
export const wildcardAcceptEncoding: ReadonlyArray<EncodingName> = [
  'gzip',
  'deflate',
];

/**
 * Our preferred encodings in order of preference
 */
export const preferredEncodings: ReadonlyArray<EncodingName> = [
  'br',
  'gzip',
  'deflate',
];

/**
 * Regex to parse Accept-Encoding directive
 */
const reDirective =
  /^\s*(gzip|compress|deflate|br|identity|\*)\s*(?:;\s*q\s*=\s*(\d(?:\.\d)?))?\s*$/;

/**
 * Parse Accept-Encoding header and determine the preferred encoding
 *
 * @param acceptEncoding - The Accept-Encoding header value
 * @param options - Configuration options
 * @returns The preferred encoding name or 'identity' for no compression
 */
export function getPreferredEncoding(
  acceptEncoding = '*',
  options: {
    wildcardAcceptEncoding?: ReadonlyArray<EncodingName>;
    preferredEncodings?: ReadonlyArray<EncodingName>;
  } = {},
): string {
  const wildcardEncodings =
    options.wildcardAcceptEncoding ?? wildcardAcceptEncoding;
  const preferred = options.preferredEncodings ?? preferredEncodings;
  const encodingWeights = parseHeader(acceptEncoding, wildcardEncodings);

  // Get ordered list of accepted encodings
  const acceptedEncodings = Array.from(encodingWeights.keys())
    // sort by weight
    .sort((a, b) => encodingWeights.get(b)! - encodingWeights.get(a)!)
    // filter by supported encodings
    .filter(
      (encoding) =>
        encoding === 'identity' ||
        typeof encodingMethods[encoding as EncodingName] === 'function',
    );

  // Group them by weights
  const weightClasses = new Map<number, Set<string>>();
  acceptedEncodings.forEach((encoding) => {
    const weight = encodingWeights.get(encoding)!;
    if (!weightClasses.has(weight)) {
      weightClasses.set(weight, new Set());
    }
    weightClasses.get(weight)!.add(encoding);
  });

  // Search by weight, descending
  const weights = Array.from(weightClasses.keys()).sort((a, b) => b - a);
  for (let i = 0; i < weights.length; i++) {
    const encodings = weightClasses.get(weights[i]!)!;
    // Return the first encoding in the preferred list
    for (let j = 0; j < preferred.length; j++) {
      const preferredEncoding = preferred[j]!;
      if (encodings.has(preferredEncoding)) {
        return preferredEncoding;
      }
    }
  }

  // No encoding matches, check to see if the client set identity, q=0
  if (encodingWeights.get('identity') === 0) {
    throw new HttpError(406, 'Please accept br, gzip, deflate, or identity.');
  }

  // By default, return nothing
  return 'identity';
}

/**
 * Parse the Accept-Encoding header and return a map of encoding weights.
 *
 * See
 * https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Encoding
 *
 * @param acceptEncoding - The Accept-Encoding header value
 * @param wildcardEncodings - The list of wildcard encodings
 * @returns A map of encoding weights
 */
const parseHeader = (
  acceptEncoding: string,
  wildcardEncodings: readonly ('gzip' | 'deflate' | 'br')[],
) => {
  const encodingWeights = new Map<string, number>();

  for (const directive of acceptEncoding.split(',')) {
    const match = reDirective.exec(directive);
    if (match === null) {
      // Not a supported encoding
      continue;
    }

    const encoding = match[1]!;

    // weight must be in [0, 1]
    const weight = Math.min(
      Math.max(
        match[2] && !isNaN(Number(match[2])) ? parseFloat(match[2]) : 1,
        0,
      ),
      1,
    );

    if (encoding === '*') {
      // Set the weights for the default encodings
      for (const enc of wildcardEncodings) {
        if (!encodingWeights.has(enc)) {
          encodingWeights.set(enc, weight);
        }
      }
      continue;
    }

    encodingWeights.set(encoding, weight);
  }
  return encodingWeights;
};
