import {describe as suite, test} from 'node:test';
import * as assert from 'node:assert';
import {
  collectResult,
  html,
  unsafeHTML,
  type RenderValue,
} from '../../lib/html.js';

suite('html', () => {
  test('plain text', async () => {
    assert.equal(html`Hello World!`.toString(), 'Hello World!');
  });

  test('simple HTML', async () => {
    assert.equal(
      html`<h1>Hello World!</h1>`.toString(),
      '<h1>Hello World!</h1>',
    );
  });

  test('indented HTML', async () => {
    // prettier-ignore
    assert.equal(html`
      <h1>Hello World!</h1>
    `.toString(), '\n<h1>Hello World!</h1>\n');

    // prettier-ignore
    assert.equal(html`
      <div>
        <p>Hello World!</p>
      </div>
    `.toString(), '\n<div>\n  <p>Hello World!</p>\n</div>\n');
  });

  test('nested HTML', async () => {
    // prettier-ignore
    assert.equal(html`
      <h1>Hello World!</h1>
        ${html`<p>Foo</p>`}
    `.toString(), '\n<h1>Hello World!</h1>\n  <p>Foo</p>\n');
  });

  test('interpolated string', async () => {
    assert.equal(
      html`<h1>Hello ${'World'}!</h1>`.toString(),
      '<h1>Hello World!</h1>',
    );
  });

  test('escapes strings', async () => {
    assert.equal(
      html`<h1>Hello ${'<World>'}!</h1>`.toString(),
      '<h1>Hello &lt;World&gt;!</h1>',
    );
  });

  test('interpolated array', async () => {
    const items = ['foo', 'bar', 'baz'];
    assert.equal(
      // prettier-ignore
      html`
        <ul>
          ${items.map((item) => html`<li>${item}</li>`)}
        </ul>`.toString(),
      '\n<ul>\n  <li>foo</li><li>bar</li><li>baz</li>\n</ul>',
    );
  });

  test('unsafeHTML', async () => {
    assert.equal(
      html`<h1>Hello ${unsafeHTML('<span>World</span>')}!</h1>`.toString(),
      '<h1>Hello <span>World</span>!</h1>',
    );
  });

  suite('Iteration', () => {
    test('simple iteration', async () => {
      assert.deepEqual(
        [...html`<h1>Hello ${'World'}!</h1>`],
        ['<h1>Hello ', 'World', '!</h1>'],
      );
    });

    test('array and nested iteration', async () => {
      const items = ['foo', 'bar', 'baz'];
      assert.deepEqual(
        // prettier-ignore
        [...html`
          <ul>
            ${items.map((item) => html`<li>${item}</li>`)}
          </ul>`],
        [
          '\n          <ul>\n            ',
          '<li>',
          'foo',
          '</li>',
          '<li>',
          'bar',
          '</li>',
          '<li>',
          'baz',
          '</li>',
          '\n          </ul>',
        ],
      );
    });

    test('async iteration', async () => {
      assert.equal(
        await collectResult(html`<h1>Hello ${Promise.resolve('World')}!</h1>`),
        '<h1>Hello World!</h1>',
      );

      const strings = await waitForResult(
        html`<h1>Hello ${Promise.resolve([html`<span>World</span>`])}!</h1>`,
      );
      assert.deepEqual(strings, ['<h1>Hello ', '<span>World</span>', '!</h1>']);

      assert.equal(
        await collectResult(
          html`<h1>Hello ${Promise.resolve([html`<span>World</span>`])}!</h1>`,
        ),
        '<h1>Hello <span>World</span>!</h1>',
      );
    });
  });
});

export const waitForResult = async (
  result: Iterable<RenderValue>,
): Promise<Array<string>> => {
  const strings = [];
  for (const chunk of result) {
    if (typeof chunk === 'string') {
      strings.push(chunk);
    } else {
      const v = await waitForResult(await chunk);
      if (typeof v === 'string') {
        strings.push(v);
      } else {
        strings.push(...v);
      }
    }
  }
  return strings;
};
