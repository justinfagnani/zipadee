/**
 * A template tag function that accepts an HTML string.
 *
 * Interpolated values are escaped by default, so that they are not interpreted
 * as HTML. To interpolate a value as HTML, use the `unsafeHTML` function.
 */
export const html = (strings: TemplateStringsArray, ...values: any[]) =>
  new HTMLPartial(strings, values);

const toString = (v: any, currentIndent: number): string => {
  if (typeof v === 'string') {
    return escape(v);
  }
  if (v instanceof HTMLPartial) {
    return v.toString(currentIndent);
  }
  if (Array.isArray(v)) {
    return v.map(toString).join('');
  }
  if (v instanceof UnsafeHTML) {
    return v.value;
  }
  return escape(String(v));
};

const indentRegex = /(?:\n)([ \t]*)(?:\S)/g;

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
      const v = values[i];
      if (typeof v === 'string') {
        yield escape(v);
      } else if (v instanceof HTMLPartial) {
        yield* v;
      } else if (Array.isArray(v)) {
        yield* yieldArray(v);
      } else if (v instanceof UnsafeHTML) {
        yield v.value;
      } else if (typeof (v as any).then === 'function') {
        yield v as Promise<RenderResult>;
      } else {
        yield escape(String(v));
      }
      yield this.strings[i + 1];
    }
  }

  // toStream(): ReadableStream {
  //   let closed = false;
  //   let waiting = false;
  //   let currentIterator;

  //     /**
  //  * A stack of open iterators.
  //  *
  //  * We need to keep this as instance state because we can pause and resume
  //  * reading values at any time and can't guarantee to run iterators to
  //  * completion in any one loop.
  //  */
  // const iterators = [result[Symbol.iterator]()];

  //   return new ReadableStream({
  //     pull(controller) {
  //       for (const part of parts) {
  //         controller.enqueue(part);
  //       }
  //       controller.close();
  //     },
  //   });

  // }
}

// const handlePromise = async (value: Promise<HTMLValue>): string => {
// };

const yieldArray = function* (array: Array<unknown>): RenderResult {
  for (const v of array) {
    if (typeof v === 'string') {
      yield escape(v);
    } else if (v instanceof HTMLPartial) {
      yield* v;
    } else if (Array.isArray(v)) {
      yield* yieldArray(v);
    } else if (v instanceof UnsafeHTML) {
      yield v.value;
    } else if (typeof (v as any).then === 'function') {
      yield v as Promise<RenderResult>;
    } else {
      yield escape(String(v));
    }
  }
};

export type HTMLValue =
  | string
  | UnsafeHTML
  | HTMLPartial
  | HTMLIterator
  | Promise<HTMLValue>;
export type HTMLIterator = IterableIterator<string | Promise<HTMLValue>>;

export type RenderValue = string | Promise<string | RenderResult>;
export type RenderResult = IterableIterator<RenderValue>;

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

export const unsafeHTML = (s: string) => new UnsafeHTML(s);

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
