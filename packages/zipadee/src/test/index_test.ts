import {App} from '@zipadee/core';
import * as assert from 'node:assert';
import {describe as suite, test} from 'node:test';
import request from 'supertest';

suite('App', () => {
  test('basic app', async () => {
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
});
