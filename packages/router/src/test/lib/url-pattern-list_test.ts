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

  test('handles wildcard (*) correctly', () => {
    const list = new URLPatternList<string>();
    const v1 = 'wildcard-files';
    list.addPattern(new URLPattern({pathname: '/files/*'}), v1);
    const match1 = list.match('/files/document.txt', 'http://example.com');
    assert.ok(match1, 'should match /files/document.txt');
    assert.deepStrictEqual(match1?.result.pathname.groups, {0: 'document.txt'});
    assert.strictEqual(match1?.value, v1);

    const match2 = list.match(
      '/files/archive/report.zip',
      'http://example.com',
    );
    assert.ok(match2, 'should match /files/archive/report.zip');
    assert.deepStrictEqual(match2?.result.pathname.groups, {
      0: 'archive/report.zip',
    });
    assert.strictEqual(match2?.value, v1);

    const noMatch = list.match('/documents/report.pdf', 'http://example.com');
    assert.strictEqual(noMatch, null, 'should not match /documents/report.pdf');
  });

  test('handles named groups (:) correctly', () => {
    const list = new URLPatternList<string>();
    const v1 = 'user-profile';
    list.addPattern(
      new URLPattern({pathname: '/users/:userId/profile/:section'}),
      v1,
    );
    const match = list.match(
      '/users/alice/profile/settings',
      'http://example.com',
    );
    assert.ok(match, 'should match with named groups');
    assert.deepStrictEqual(match?.result.pathname.groups, {
      userId: 'alice',
      section: 'settings',
    });
    assert.strictEqual(match?.value, v1);

    const noMatch = list.match('/users/bob/settings', 'http://example.com');
    assert.strictEqual(noMatch, null, 'should not match with missing group');
  });

  test('handles optional named groups ({...}?) correctly', () => {
    const list = new URLPatternList<string>();
    const v1 = 'optional-group';
    list.addPattern(new URLPattern({pathname: '/api/{v:version/}?data'}), v1);

    const matchWithGroup = list.match('/api/v1/data', 'http://example.com');
    assert.ok(matchWithGroup, 'should match with optional group present');
    assert.deepStrictEqual(matchWithGroup?.result.pathname.groups, {
      version: '1',
    });
    assert.strictEqual(matchWithGroup?.value, v1);

    const matchWithoutGroup = list.match('/api/data', 'http://example.com');
    assert.ok(matchWithoutGroup, 'should match with optional group absent');
    assert.deepStrictEqual(matchWithoutGroup?.result.pathname.groups, {
      version: undefined,
    });
    assert.strictEqual(matchWithoutGroup?.value, v1);
  });

  test('handles non-capturing groups (?:...) correctly', () => {
    const list = new URLPatternList<string>();
    const v1 = 'non-capturing';
    // Example: /img/(?:small|large)/:name
    list.addPattern(
      new URLPattern({pathname: '/img/(small|large)/:name.jpg'}),
      v1,
    );

    const matchSmall = list.match('/img/small/cat.jpg', 'http://example.com');
    assert.ok(matchSmall, 'should match /img/small/cat.jpg');
    assert.deepStrictEqual(matchSmall?.result.pathname.groups, {
      '0': 'small',
      name: 'cat',
    });
    assert.strictEqual(matchSmall?.value, v1);

    const matchLarge = list.match('/img/large/dog.jpg', 'http://example.com');
    assert.ok(matchLarge, 'should match /img/large/dog.jpg');
    assert.deepStrictEqual(matchLarge?.result.pathname.groups, {
      '0': 'large',
      name: 'dog',
    });
    assert.strictEqual(matchLarge?.value, v1);

    const noMatch = list.match('/img/medium/rat.jpg', 'http://example.com');
    assert.strictEqual(noMatch, null, 'should not match /img/medium/rat.jpg');
  });

  test('handles regex groups (...) correctly', () => {
    const list = new URLPatternList<string>();
    const v1 = 'regex-group';
    // Example: /product/{id:\\d+}
    list.addPattern(new URLPattern({pathname: '/product/:id(\\d+)'}), v1);

    const match = list.match('/product/12345', 'http://example.com');
    assert.ok(match, 'should match /product/12345 with regex group');
    assert.deepStrictEqual(match?.result.pathname.groups, {id: '12345'});
    assert.strictEqual(match?.value, v1);

    const noMatch = list.match('/product/abc', 'http://example.com');
    assert.strictEqual(
      noMatch,
      null,
      'should not match /product/abc with regex group',
    );
  });

  test('handles full wildcard (/*) at the end of a segment', () => {
    const list = new URLPatternList<string>();
    const v1 = 'segment-wildcard';
    list.addPattern(new URLPattern({pathname: '/data/:collection/*'}), v1);

    const match = list.match('/data/items/item1/details', 'http://example.com');
    assert.ok(match, 'should match path with wildcard segment');
    assert.deepStrictEqual(match?.result.pathname.groups, {
      collection: 'items',
      0: 'item1/details',
    });
    assert.strictEqual(match?.value, v1);

    const noMatch = list.match('/data/items', 'http://example.com'); // Wildcard expects something after /items/
    assert.strictEqual(
      noMatch,
      null,
      'should not match if wildcard part is empty and pattern expects content',
    );
  });

  test('handles plus (+) quantifier for named groups correctly', () => {
    const list = new URLPatternList<string>();
    const v1 = 'plus-quantifier';
    list.addPattern(new URLPattern({pathname: '/path/:segments+'}), v1);

    const matchOne = list.match('/path/a', 'http://example.com');
    assert.ok(matchOne, 'should match one segment with +');
    assert.deepStrictEqual(matchOne?.result.pathname.groups, {segments: 'a'});
    assert.strictEqual(matchOne?.value, v1);

    const matchMultiple = list.match('/path/a/b/c', 'http://example.com');
    assert.ok(matchMultiple, 'should match multiple segments with +');
    assert.deepStrictEqual(matchMultiple?.result.pathname.groups, {
      segments: 'a/b/c',
    });
    assert.strictEqual(matchMultiple?.value, v1);

    const noMatch = list.match('/path/', 'http://example.com'); // + requires at least one segment
    assert.strictEqual(noMatch, null, 'should not match empty segments with +');
  });

  test('handles star (*) quantifier for named groups correctly', () => {
    const list = new URLPatternList<string>();
    const v1 = 'star-quantifier';
    list.addPattern(new URLPattern({pathname: '/path/:segments*'}), v1);

    const matchZero = list.match('/path', 'http://example.com');
    assert.ok(matchZero, 'should match zero segments with *');
    assert.deepStrictEqual(matchZero?.result.pathname.groups, {
      segments: undefined,
    }); // Or {} depending on URLPattern polyfill behavior for empty * group
    assert.strictEqual(matchZero?.value, v1);

    const matchOne = list.match('/path/a', 'http://example.com');
    assert.ok(matchOne, 'should match one segment with *');
    assert.deepStrictEqual(matchOne?.result.pathname.groups, {segments: 'a'});
    assert.strictEqual(matchOne?.value, v1);

    const matchMultiple = list.match('/path/a/b/c', 'http://example.com');
    assert.ok(matchMultiple, 'should match multiple segments with *');
    assert.deepStrictEqual(matchMultiple?.result.pathname.groups, {
      segments: 'a/b/c',
    });
    assert.strictEqual(matchMultiple?.value, v1);
  });
});
