import type {Writable} from 'node:stream';

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
  readonly strings: TemplateStringsArray;
  readonly values: unknown[];

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

  [Symbol.iterator](): RenderResult {
    return new HTMLIterator(this);
  }
}

// Keep this monomorphic for performance.
type HTMLIteratorState =
  | {
      kind: 'html';
      // An index into the conceptually zipped array of strings and values.
      // If even, the next value to yield is a string; if odd, it's a value.
      index: number;
      container: HTMLPartial;
    }
  | {
      kind: 'array';
      index: number;
      container: Array<unknown>;
    }
  | {
      kind: 'iterable';
      index: undefined;
      container: Iterator<unknown>;
    };

export class HTMLIterator implements IterableIterator<RenderValue> {
  #stack: Array<HTMLIteratorState>;

  constructor(partial: HTMLPartial) {
    this.#stack = [{kind: 'html', index: 0, container: partial}];
  }

  next(): IteratorResult<RenderValue> {
    while (this.#stack.length > 0) {
      const state = this.#stack.at(-1)!;
      const {kind, index, container} = state;

      let done = false;
      let value: unknown;

      if (kind === 'html') {
        const i = Math.floor(index / 2);
        const isEven = index % 2 === 0;

        state.index++;

        if (isEven) {
          // Even indices are always strings. There is always one more string
          // than value, so we can always yield the string at this index and if
          // it's the last string, we'll yield a done result next time.
          return {
            done: false,
            value: container.strings[i],
          };
        }

        done = index > container.values.length;
        value = container.values[i];
      } else if (kind === 'array') {
        done = index >= container.length;
        value = container[index];
        state.index++;
      } else if (kind === 'iterable') {
        const next = container.next();
        done = next.done ?? false;
        value = next.value;
      }

      if (done) {
        // If the current container is done, pop it off the stack and continue
        // processing the parent container.
        this.#stack.pop();
        continue;
      }

      if (value == null) {
        value = '';
      } else if (typeof value === 'string') {
        // Do nothing
      } else if (value instanceof HTMLPartial) {
        this.#stack.push({kind: 'html', index: 0, container: value});
        continue;
      } else if (Array.isArray(value)) {
        this.#stack.push({kind: 'array', index: 0, container: value});
        continue;
      } else if (isIterable(value)) {
        this.#stack.push({
          kind: 'iterable',
          index: undefined,
          container: value[Symbol.iterator](),
        });
        continue;
      } else if (value instanceof UnsafeHTML) {
        value = value.value;
      } else if (typeof (value as any).then === 'function') {
        // A Promise-like object. Do noting.
      } else {
        value = String(value);
      }
      return {
        done,
        value: value as string,
      };
    }

    return {done: true, value: undefined};
  }

  [Symbol.iterator](): IterableIterator<RenderValue> {
    return this;
  }
}

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
 * Writes an HTMLPartial to a Writable stream.
 *
 * This is optimized slightly better than using the HTMLPartial as an
 * iterable directly, because it avoids creating a lot of intermediate
 * IteratorResult objects.
 * 
 * If `flushSize` is provided, the stream will be corked until at least
 * `flushSize` bytes have been written, at which point it will be uncorked.
 * Streams are always uncorked before awaiting a Promise.
 *
 * Does not call writable.end() when done.
 *
 * @param partial
 * @param writable
 * @returns
 */
export const pipeToWritable = async (
  partial: HTMLPartial,
  writable: Writable,
  options?: {flushSize?: number},
): Promise<void> => {
  const flushSize = options?.flushSize ?? 0;

  if (flushSize < 0) {
    throw new RangeError('flushSize must be non-negative');
  }

  let writeSize = 0;

  const stack: Array<HTMLIteratorState> = [
    {kind: 'html', index: 0, container: partial},
  ];

  if (flushSize !== 0) {
    // We might write a lot of small chunks, so cork the stream until we've
    // written enough to flush.
    writable.cork();
  }

  while (stack.length > 0) {
    if (writeSize > flushSize) {
      writable.uncork();
      writable.cork();
      writeSize = 0;
    }
    const state = stack.at(-1)!;
    const {kind, index, container} = state;

    let done = false;
    let value: unknown;

    if (kind === 'html') {
      const i = Math.floor(index / 2);
      const isEven = index % 2 === 0;

      state.index++;

      if (isEven) {
        const buffer = Buffer.from(container.strings[i], 'utf-8');
        writeSize += buffer.length;
        // Even indices are always strings. There is always one more string
        // than value, so we can always yield the string at this index and if
        // it's the last string, we'll yield a done result next time.
        writable.write(buffer);
        continue;
      }

      done = index > container.values.length;
      value = container.values[i];
    } else if (kind === 'array') {
      done = index >= container.length;
      value = container[index];
      state.index++;
    } else if (kind === 'iterable') {
      const next = container.next();
      done = next.done ?? false;
      value = next.value;
    }

    if (done) {
      // If the current container is done, pop it off the stack and continue
      // processing the parent container.
      stack.pop();
      continue;
    }

    let continueWriting = true;

    while (value != null) {
      if (typeof value === 'string') {
        value = escape(value);
        writeSize += Buffer.byteLength(value as string, 'utf-8');
        continueWriting = writable.write(value);
        break;
      } else if (value instanceof HTMLPartial) {
        stack.push({kind: 'html', index: 0, container: value});
        break;
      } else if (Array.isArray(value)) {
        stack.push({kind: 'array', index: 0, container: value});
        break;
      } else if (isIterable(value)) {
        stack.push({
          kind: 'iterable',
          index: undefined,
          container: value[Symbol.iterator](),
        });
        break;
      } else if (value instanceof UnsafeHTML) {
        writeSize += Buffer.byteLength(value.value, 'utf-8');
        continueWriting = writable.write(value.value);
        break;
      } else if (typeof (value as any).then === 'function') {
        // A Promise-like object

        // Always flush before awaiting:
        if (flushSize !== 0 && writeSize > 0) {
          writable.uncork();
          writable.cork();
          writeSize = 0;
        }

        // Await and then process the resolved value in the next loop iteration
        value = await value;
      } else {
        value = escape(String(value));
        writeSize += Buffer.byteLength(value as string, 'utf-8');
        continueWriting = writable.write(value);
        break;
      }
    }

    if (continueWriting === false) {
      // TODO (justinfagnani): I'm not sure if we need to do manually uncork
      // here. If a stream is full and corked, will it write anyway? Maybe it'll
      // never drain if it's corked?
      // For now, we'll just uncork and then cork again after draining.
      let uncork = flushSize !== 0 && writeSize > 0;
      if (uncork) {
        writable.uncork();
        writeSize = 0;
      }

      await new Promise<void>((resolve, reject) => {
        writable.once('drain', resolve);
        writable.once('error', reject);
      });

      continueWriting = true;
      if (uncork) {
        writable.cork();
      }
    }
  }
  if (flushSize !== 0) {
    writable.uncork();
  }
};

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
  readonly value: string;

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

const replacer = (match: string) =>
  replacements[match as keyof typeof replacements];

/**
 * Replaces characters which have special meaning in HTML (&<>"') with escaped
 * HTML entities ("&amp;", "&lt;", etc.).
 */
export const escape = (str: string) => str.replaceAll(/[&<>"']/g, replacer);
