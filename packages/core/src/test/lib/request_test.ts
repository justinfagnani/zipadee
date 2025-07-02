import * as assert from 'node:assert';
import {describe as suite, test} from 'node:test';
import request from 'supertest';
import {App} from '../../index.js';

suite('Request', () => {
  test('can read body as stream', async () => {
    using app = new App();
    const decoder = new TextDecoder()

    app.use(async (req, res, _next) => {
      let body = '';
      for await (const chunk of req.body) {
        body += decoder.decode(chunk);
      }
      res.body = `Received body: ${body}`;
    });

    await app.listen();

    const response = await request(app.server).post('/').send('Hello World!');

    assert.equal(response.status, 200);
    assert.strictEqual(
      response.headers['content-type'],
      'text/plain; charset=utf-8',
    );
    assert.strictEqual(response.headers['content-length'], '27');
    assert.equal(response.text, 'Received body: Hello World!');
  });
  
  test('can read body as text', async () => {
    using app = new App();

    app.use(async (req, res, _next) => {
      res.body = `Received body: ${await req.text()}`;
    });

    await app.listen();

    const response = await request(app.server).post('/').send('Hello World!');

    assert.equal(response.status, 200);
    assert.strictEqual(
      response.headers['content-type'],
      'text/plain; charset=utf-8',
    );
    assert.strictEqual(response.headers['content-length'], '27');
    assert.equal(response.text, 'Received body: Hello World!');
  });
});
