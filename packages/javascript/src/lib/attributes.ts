/**
 * Parses import attributes from a source string.
 *
 * Import attributes are similar to JSON or an object literal. They're a
 * key-value object, where the keys do not need to be quoted, and the values
 * must be quoted strings. Key-value pairs are separated by commas, and
 * whitespace is ignored.
 *
 * @param source - The source string containing just the import attributes.
 *
 * @internal
 */
export const parseImportAttributes = (expr: string): Map<string, string> =>
  new Parser(expr).parse();

const isWhitespace = (ch: number) =>
  ch === 9 /* \t */ ||
  ch === 10 /* \n */ ||
  ch === 13 /* \r */ ||
  ch === 32; /* space */

// TODO(justinfagnani): allow code points > 127
const isIdentStart = (ch: number) =>
  ch === 95 /* _ */ ||
  ch === 36 /* $ */ ||
  // ch &= ~32 puts ch into the range [65,90] [A-Z] only if ch was already in
  // the that range or in the range [97,122] [a-z]. We must mutate ch only after
  // checking other characters, thus the comma operator.
  ((ch &= ~32), 65 /* A */ <= ch && ch <= 90); /* Z */

// TODO(justinfagnani): allow code points > 127
const isIdentifier = (ch: number) => isIdentStart(ch);

const isQuote = (ch: number) => ch === 34 /* " */ || ch === 39; /* ' */

const escapeString = (str: string) =>
  str.replace(/\\(.)/g, (_match, group) => {
    switch (group) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      default:
        return group;
    }
  });

class Parser {
  #input: string;
  #index = -1;
  #tokenStart = 0;
  #next?: number;

  constructor(input: string) {
    this.#input = input;
    this.#advance();
  }

  parse(): Map<string, string> {
    this.#parseMapStart();
    const entries = new Map<string, string>();
    do {
      this.#advanceWhitespace();
      if (this.#next === 125 /* } */) {
        break; // end of map
      }
      const key = this.#parseKey();
      this.#parseColon();
      const value = this.#parseString();
      entries.set(key, value);
    } while (this.#parseCommaOrMapEnd());
    return entries;
  }

  #advance(resetTokenStart?: boolean) {
    this.#index++;
    if (this.#index < this.#input.length) {
      this.#next = this.#input.charCodeAt(this.#index);
      if (resetTokenStart === true) {
        this.#tokenStart = this.#index;
      }
    } else {
      this.#next = undefined;
    }
  }

  #advanceWhitespace() {
    const l = this.#input.length;
    let index = this.#index;
    let char = this.#next;
    while (index < l && isWhitespace(char!)) {
      char = this.#input.charCodeAt(++index);
    }
    this.#tokenStart = this.#index = index;
    this.#next = char;
  }

  #getValue() {
    const v = this.#input.substring(this.#tokenStart, this.#index);
    this.#tokenStart = this.#index;
    return v;
  }

  #parseColon() {
    this.#advanceWhitespace();
    if (this.#next === 58 /* : */) {
      this.#advance();
    } else {
      throw new Error(`Expected :, got ${this.#next}`);
    }
  }

  #parseString() {
    this.#advanceWhitespace();
    const quoteChar = this.#next;
    this.#advance(true);
    while (this.#next !== quoteChar) {
      if (this.#next === undefined) {
        throw new Error('unterminated string');
      }
      // @ts-ignore
      if (this.#next === 92 /* \ */) {
        this.#advance();
        if (this.#next === undefined) {
          throw new Error('unterminated string');
        }
      }
      this.#advance();
    }
    const value = escapeString(this.#getValue());
    this.#advance();
    return value;
  }

  #parseKey() {
    this.#advanceWhitespace();
    if (isQuote(this.#next!)) {
      return this.#parseString();
    } else if (isIdentStart(this.#next!)) {
      do {
        this.#advance();
      } while (isIdentifier(this.#next!));
      return this.#getValue();
    } else {
      throw new Error(`expected string or identifier, got ${this.#next}`);
    }
  }

  #parseMapStart() {
    this.#advanceWhitespace();
    if (this.#next === 123 /* { */) {
      this.#advance(true);
    } else {
      throw new Error(`expected {, got ${this.#next}`);
    }
  }

  #parseCommaOrMapEnd() {
    this.#advanceWhitespace();
    if (this.#next === 125 /* } */) {
      this.#advance();
      return false;
    }
    if (this.#next === 44 /* , */) {
      this.#advance();
      return true;
    }
    throw new Error(`expected }, got ${this.#next}`);
  }
}
