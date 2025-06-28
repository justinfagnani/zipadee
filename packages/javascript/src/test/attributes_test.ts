import {describe as suite, test} from 'node:test';
import * as assert from 'node:assert';
import {parseImportAttributes} from '../lib/attributes.js';

suite('parseImportAttributes', () => {
  test('parses single import attribute', () => {
    assert.deepEqual(
      parseImportAttributes(`{type: 'css'}`),
      new Map([['type', 'css']]),
    );
    assert.deepEqual(
      parseImportAttributes(` { type : 'css' } `),
      new Map([['type', 'css']]),
    );
    assert.deepEqual(
      parseImportAttributes(`{type: 'css',}`),
      new Map([['type', 'css']]),
    );
    assert.deepEqual(
      parseImportAttributes(`{type: "css"}`),
      new Map([['type', 'css']]),
    );
    assert.deepEqual(
      parseImportAttributes(`{'type': "css"}`),
      new Map([['type', 'css']]),
    );
    assert.deepEqual(
      parseImportAttributes(`{"type": "css"}`),
      new Map([['type', 'css']]),
    );
  });

  test('parses multiple import attributes', () => {
    assert.deepEqual(
      parseImportAttributes(`{type: 'css', as: 'style'}`),
      new Map([
        ['type', 'css'],
        ['as', 'style'],
      ]),
    );
    assert.deepEqual(
      parseImportAttributes(`{ type : 'css' , as : 'style' } `),
      new Map([
        ['type', 'css'],
        ['as', 'style'],
      ]),
    );
  });

  test('returns empty object for no attributes', () => {
    assert.deepEqual(parseImportAttributes(`{}`), new Map());
    assert.deepEqual(parseImportAttributes(` { } `), new Map());
  });

  test('throws for invalid import attributes', () => {
    assert.throws(() => parseImportAttributes(``));
    assert.throws(() => parseImportAttributes(`{type: css}`));
    assert.throws(() => parseImportAttributes(`{: css}`));
    assert.throws(() => parseImportAttributes(`{type}`));
    assert.throws(() => console.log(parseImportAttributes(`{type: 'css"}`)));
    assert.throws(() => parseImportAttributes(`{type: css`));
    assert.throws(() => parseImportAttributes(`type: css}`));
    assert.throws(() => parseImportAttributes(`{type: css} x`));
  });
});
