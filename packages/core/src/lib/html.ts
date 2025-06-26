/**
 * A template tag function that accepts an HTML string.
 *
 * Interpolated values are escaped by default, so that they are not interpreted
 * as HTML. To interpolate a value as HTML, use the `unsafeHTML` function.
 */
export const html = (strings: TemplateStringsArray, ...values: any[]) =>
  new HTMLPartial(strings, values);

const isIterable = (value: unknown): value is Iterable<unknown> =>
  Array.isArray(value) ||
  typeof (value as any)?.[Symbol.iterator] === 'function';

/**
 * Converts a value to a string, escaping it if necessary.
 *
 * - If the value is an instance of `HTMLPartial`, it calls its `toString`
 *   method with the current indentation.
 * - If the value is an array, it recursively converts each element to a string.
 * - If the value is an instance of `UnsafeHTML`, it returns its `value`
 *   property without escaping.
 * - If the value is `null` or `undefined`, it returns an empty string.
 *   Otherwise, it converts the value to a string and escapes it.
 */
const toString = (v: unknown, currentIndent: number): string => {
  if (v == null) {
    return '';
  }
  if (typeof v === 'string') {
    return escape(v);
  }
  if (v instanceof HTMLPartial) {
    return v.toString(currentIndent);
  }
  if (Array.isArray(v) || isIterable(v)) {
    return Array.from(v).map(toString).join('');
  }
  if (v instanceof UnsafeHTML) {
    return v.value;
  }
  return escape(String(v));
};

/**
 * Regular expression to match the indentation of the first non-empty line
 * in a string. It captures the indentation (spaces or tabs) before the first
 * non-whitespace character after a newline.
 */
const indentRegex = /(?:\n)([ \t]*)(?:\S)/g;

/**
 * Represents a partial HTML template result that can be rendered with
 * interpolated values. It supports indentation, nested templates, iterables of
 * values, and escaping of values.
 *
 * The `toString()` method returns the rendered HTML as a string, propagating
 * the indentation level.
 *
 * To support streaming HTTP, HTMLPartial is an iterable that yields the strings
 * or Promises of strings in the correct order for rendering. It's a synchronous
 * iterable even though it can yield Promises, because synchronous iterables are
 * much faster than asynchronous iterables, especially if only synchronous
 * values are being rendered. This means that the consumer of the iterable must
 * handle any Promises themselves.
 */
export class HTMLPartial {
  strings: TemplateStringsArray;
  values: any[];

  constructor(strings: TemplateStringsArray, values: any[]) {
    this.strings = strings;
    this.values = values;
  }

  toString(indent: number = 0): string {
    // Find the minimum indent of the first line that is not empty, so that we
    // can unindent the whole string by that amount.
    let minIndent = Infinity;
    for (const string of this.strings) {
      indentRegex.lastIndex = 0;
      const match = indentRegex.exec(string);
      if (match !== null) {
        minIndent = Math.min(minIndent, ...match.map((match) => match.length));
      }
    }

    let currentIndent = indent;
    let result = fixIndent(minIndent, indent, this.strings[0]);
    const values = this.values;

    for (let i = 0; i < values.length; i++) {
      indentRegex.lastIndex = 0;
      const match = indentRegex.exec(this.strings[i]);
      if (match !== null) {
        currentIndent = match[1].length - minIndent + indent;
      }
      result +=
        toString(values[i], currentIndent) +
        fixIndent(minIndent, indent, this.strings[i + 1]);
    }

    return result;
  }

  *[Symbol.iterator](): RenderResult {
    const values = this.values;
    yield this.strings[0];

    for (let i = 0; i < values.length; i++) {
      yield* yieldValue(values[i]);
      yield this.strings[i + 1];
    }
  }
}

const yieldValue = function* (v: unknown): RenderResult {
  if (v == null) {
    yield '';
  } else if (typeof v === 'string') {
    yield escape(v);
  } else if (v instanceof HTMLPartial) {
    yield* v;
  } else if (Array.isArray(v) || isIterable(v)) {
    for (const i of v) {
      yield* yieldValue(i);
    }
  } else if (v instanceof UnsafeHTML) {
    yield v.value;
  } else if (typeof (v as any).then === 'function') {
    yield v as Promise<RenderResult>;
  } else {
    yield escape(String(v));
  }
};

export type RenderValue = string | Promise<string | RenderResult>;

/**
 * A rendered value as an iterable of strings or Promises of a RenderResult.
 *
 * This type is a synchronous Iterable so that consumers do not have to await
 * every value according to the JS asynchronous iterator protocol, which would
 * cause additional overhead compared to a sync iterator.
 *
 * Consumers should check the type of each value emitted by the iterator, and
 * await it if it is a Promise.
 *
 * The utility function {@link collectRenderResult} does this for you.
 */
export type RenderResult = IterableIterator<RenderValue>;

/**
 * Joins a RenderResult into a string.
 */
export const collectResult = async (
  result: Iterable<RenderValue>,
): Promise<string> => {
  let value = '';
  for (const chunk of result) {
    value +=
      typeof chunk === 'string' ? chunk : await collectResult(await chunk);
  }
  return value;
};

/**
 * Wraps a string in an `UnsafeHTML` object, which indicates that the
 * string should be rendered as raw HTML without escaping.
 */
export const unsafeHTML = (s: string) => new UnsafeHTML(s);

/**
 * Represents a value that should be rendered as raw HTML without escaping.
 */
export class UnsafeHTML {
  value: string;

  constructor(value: string) {
    this.value = value;
  }
}

const fixIndent = (remove: number, add: number, s: string) => {
  const re = new RegExp(`^[ \\t]{0,${remove}}`, 'gm');
  return s.replaceAll(re, ' '.repeat(add));
};

const replacements = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos',
};

/**
 * Replaces characters which have special meaning in HTML (&<>"') with escaped
 * HTML entities ("&amp;", "&lt;", etc.).
 */
export const escape = (str: string) =>
  str.replaceAll(
    /[&<>"']/g,
    (char) => replacements[char as keyof typeof replacements],
  );
