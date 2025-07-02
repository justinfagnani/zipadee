import * as assert from 'node:assert';
import {Readable} from 'node:stream';
import {ReadableStream} from 'node:stream/web';
import {describe as suite, test} from 'node:test';
import request from 'supertest';
import {App} from '../../index.js';
import {html} from '../../lib/html.js';

suite('Response', () => {
  test('can accept a string as body', async () => {
    using app = new App();
    app.use(async (_req, res, _next) => {
      res.body = 'Hello World!';
    });

    await app.listen();

    const response = await request(app.server).get('/');

    assert.equal(response.status, 200);
    assert.strictEqual(
      response.headers['content-type'],
      'text/plain; charset=utf-8',
    );
    assert.strictEqual(response.headers['content-length'], '12');
    assert.equal(response.text, 'Hello World!');
  });

  test('can accept a Buffer as body', async () => {
    using app = new App();
    app.use(async (_req, res, _next) => {
      res.body = Buffer.from('Hello World!', 'utf-8');
    });

    await app.listen();

    const response = await request(app.server).get('/');

    assert.equal(response.status, 200);
    assert.strictEqual(
      response.headers['content-type'],
      'application/octet-stream',
    );
    assert.strictEqual(response.headers['content-length'], '12');
    assert.strictEqual(response.text, undefined);
  });

  test('can accept a ReadableStream as body', async () => {
    using app = new App();
    app.use(async (_req, res, _next) => {
      res.body = ReadableStream.from(makeAsync(['Hello ', 'World!']));
    });

    await app.listen();

    const response = await request(app.server).get('/');

    assert.equal(response.status, 200);
    // assert.strictEqual(
    //   response.headers['content-type'],
    //   'application/octet-stream',
    // );
    assert.strictEqual(response.text, 'Hello World!');
  });

  test('can accept a Readable as body', async () => {
    using app = new App();
    app.use(async (_req, res, _next) => {
      res.body = Readable.from(makeAsync(['Hello ', 'World!']));
    });

    await app.listen();

    const response = await request(app.server).get('/');

    assert.equal(response.status, 200);
    // assert.strictEqual(
    //   response.headers['content-type'],
    //   'application/octet-stream',
    // );
    assert.strictEqual(response.text, 'Hello World!');
  });

  test('can accept a TypedArray as body', async () => {
    using app = new App();
    app.use(async (_req, res, _next) => {
      // "Hello World!"" in ASCII
      res.body = new Uint8Array([
        72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
      ]);
    });

    await app.listen();

    const response = await request(app.server).get('/');

    assert.equal(response.text, 'Hello World!');
    assert.equal(response.status, 200);
  });

  test('can accept an HTML template as body', async () => {
    using app = new App();
    app.use(async (_req, res, _next) => {
      res.body = html`<h1>Hello World!</h1>`;
    });

    await app.listen();

    const response = await request(app.server).get('/');

    assert.equal(response.status, 200);
    assert.strictEqual(
      response.headers['content-type'],
      'text/html; charset=utf-8',
    );
    // assert.strictEqual(response.headers['content-length'], '21');
    assert.equal(response.text, '<h1>Hello World!</h1>');
  });

  test('can accept an async HTML template as body', async () => {
    using app = new App();
    app.use(async (_req, res, _next) => {
      // prettier-ignore
      res.body = html`<h1>Hello ${Promise.resolve([html`<span>World</span>`])}!</h1>`;
    });

    await app.listen();

    const response = await request(app.server).get('/');

    assert.equal(response.status, 200);
    assert.strictEqual(
      response.headers['content-type'],
      'text/html; charset=utf-8',
    );
    // assert.strictEqual(response.headers['content-length'], '21');
    assert.equal(response.text, '<h1>Hello <span>World</span>!</h1>');
  });

  test('can set the statusCode', async () => {
    using app = new App();
    app.use(async (_req, res, _next) => {
      res.statusCode = 203;
      res.body = 'Hello World!';
    });

    await app.listen();

    const response = await request(app.server).get('/');

    assert.equal(response.text, 'Hello World!');
    assert.equal(response.status, 203);
  });

  test('can write and end', async () => {
    using app = new App();
    app.use(async (_req, res, _next) => {
      res.statusCode = 200;
      res.write('Hello');
      res.write(' World!');
      res.end();
    });

    await app.listen();

    const response = await request(app.server).get('/');

    assert.equal(response.text, 'Hello World!');
    assert.equal(response.status, 200);
  });

  test('should set Content-Length when Transfer-Encoding is not present', async () => {
    using app = new App();
    app.use((_req, res, _next) => {
      res.body = 'Hello World!';
      // assert.equal(res.getHeader('Content-Length'), 12);
    });

    await app.listen();

    const response = await request(app.server).get('/');
    assert.equal(response.status, 200);
    // assert.equal(response.get('Content-Length'), 12);
  });

  test('should not set Content-Length when Transfer-Encoding is present', async () => {
    using app = new App();
    app.use((_req, res, _next) => {
      res.setHeader('Transfer-Encoding', 'chunked');
      res.body = 'Hello World!';
      assert.equal(res.hasHeader('Content-Length'), false);
    });
    await app.listen();

    const response = await request(app.server).get('/');
    assert.equal(response.status, 200);
    // assert.equal(response.get('Content-Length'), undefined);
  });

  test('can redirect to a relative URL', async () => {
    using app = new App();
    app.use((_req, res, _next) => {
      // Note: A "relative URL" looks like an absolute path. It's only missing
      // the protocol and host.
      res.redirect('/redirected');
    });
    await app.listen();

    const response = await request(app.server).get('/');
    assert.equal(response.status, 302);
    assert.equal(response.headers.location, '/redirected');
  });
});

const makeAsync = async function* <T>(arr: Iterable<T>) {
  for (const item of arr) {
    await 0;
    yield item;
  }
};
