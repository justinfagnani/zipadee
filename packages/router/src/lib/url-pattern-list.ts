/**
 * A collection of URL patterns, with APIs for matching URLs against those
 * patterns.
 */
export interface URLPatternListItem<T> {
  pattern: URLPattern;
  value: T;
}

export interface URLPatternListMatch<T> {
  result: URLPatternResult;
  value: T;
}

export class URLPatternList<T> {
  #items: Array<URLPatternListItem<T>>;

  constructor() {
    this.#items = [];
  }

  addPattern(pattern: URLPattern, value: T) {
    // TODO: when a new pattern is added, we update our fast data structure
    this.#items.push({pattern, value});
  }

  match(path: string, baseUrl?: string): URLPatternListMatch<T> | null {
    // TODO: instead of iterating over all patterns, we should use a more efficient
    // data structure to find the best match. This could be a trie or a similar
    // structure that allows for fast prefix matching.
    for (const item of this.#items) {
      if (item.pattern.test(path, baseUrl)) {
        const result = item.pattern.exec(path, baseUrl);
        if (result !== null) {
          return {result, value: item.value};
        }
      }
    }
    return null;
  }
}
