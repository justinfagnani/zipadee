import {describe as suite, test} from 'node:test';
import {URLPatternList} from '../../lib/url-pattern-list.js';
import {URLPattern} from 'urlpattern-polyfill';
import * as assert from 'node:assert';

suite('URLPatternList', () => {
  test('matches a single pattern and returns its value', () => {
    const list = new URLPatternList<string>();
    const patternValue = 'testValue1';
    list.addPattern(new URLPattern({pathname: '/foo'}), patternValue);
    const match = list.match('/foo', 'http://example.com');
    assert.ok(match, 'should match');
    assert.deepStrictEqual(match?.result.pathname.groups, {});
    assert.strictEqual(
      match?.value,
      patternValue,
      'should return the correct value',
    );
  });

  test('returns null when no patterns match', () => {
    const list = new URLPatternList<number>();
    list.addPattern(new URLPattern({pathname: '/foo'}), 1);
    const match = list.match('/bar', 'http://example.com');
    assert.strictEqual(match, null, 'should not match');
  });

  test('matches the first added pattern that tests true and returns its value', () => {
    const list = new URLPatternList<{type: string}>();
    const value1 = {type: 'id'};
    const value2 = {type: 'bookId'};
    // Pattern 1: matches /books/:id
    list.addPattern(new URLPattern({pathname: '/books/:id'}), value1);
    // Pattern 2: also matches /books/*, but with a different group name
    list.addPattern(new URLPattern({pathname: '/books/:bookId'}), value2);

    const match = list.match('/books/123', 'http://example.com');
    assert.ok(match, 'should match');
    // Assert that the first pattern was matched by checking its group name and value
    assert.deepStrictEqual(
      match?.result.pathname.groups,
      {id: '123'},
      'Should match the first pattern and capture its group',
    );
    assert.strictEqual(
      match?.value,
      value1,
      'Should return the value of the first matched pattern',
    );
  });

  test('matches a pattern with a base URL and returns its value', () => {
    const list = new URLPatternList<boolean>();
    const patternValue = true;
    list.addPattern(new URLPattern({pathname: '/foo'}), patternValue);
    const match = list.match('/foo', 'http://localhost');
    assert.ok(match, 'should match with base URL');
    assert.strictEqual(match?.value, patternValue);
  });

  test('matches a pattern with parameters and returns its value', () => {
    const list = new URLPatternList<string>();
    const patternValue = 'userRoute';
    list.addPattern(new URLPattern({pathname: '/users/:id'}), patternValue);
    const match = list.match('/users/123', 'http://example.com');
    assert.ok(match, 'should match');
    assert.deepStrictEqual(match?.result.pathname.groups, {id: '123'});
    assert.strictEqual(match?.value, patternValue);
  });

  test('returns null when list is empty', () => {
    const list = new URLPatternList<any>();
    const match = list.match('/foo', 'http://example.com');
    assert.strictEqual(match, null, 'should not match an empty list');
  });

  test('matches patterns in the order they were added and returns correct value', () => {
    const list = new URLPatternList<string>();
    const valueSpecific = 'item-id';
    const valueGeneral = 'item-special'; // This value won't be matched in the second case due to order

    // More specific pattern by structure, but added first, so it takes precedence for /items/:id type matches
    list.addPattern(new URLPattern({pathname: '/items/:id'}), valueSpecific);
    list.addPattern(new URLPattern({pathname: '/items/special'}), valueGeneral);

    let match = list.match('/items/123', 'http://example.com');
    assert.ok(match, 'should match /items/:id');
    assert.deepStrictEqual(match?.result.pathname.groups, {id: '123'});
    assert.strictEqual(match?.value, valueSpecific);

    match = list.match('/items/special', 'http://example.com');
    // The first pattern '/items/:id' will match '/items/special' and capture {id: 'special'}
    assert.ok(match, 'should match /items/:id for /items/special due to order');
    assert.deepStrictEqual(match?.result.pathname.groups, {id: 'special'});
    assert.strictEqual(
      match?.value,
      valueSpecific,
      'Should return value of the first pattern that matched',
    );
  });

  test('addPattern correctly adds a pattern and value that can be matched', () => {
    const list = new URLPatternList<number>();
    const patternValue = 42;
    const pattern = new URLPattern({pathname: '/test-add'});
    list.addPattern(pattern, patternValue);
    const match = list.match('/test-add', 'http://example.com');
    assert.ok(match, 'Pattern added via addPattern should be matchable');
    assert.deepStrictEqual(match?.result.pathname.groups, {});
    assert.strictEqual(match?.value, patternValue);
  });

  // TODO: Add tests for the planned trie/fast data structure implementation
  // once that is in place, as behavior might change (e.g. specificity might
  // take precedence over insertion order).
});
