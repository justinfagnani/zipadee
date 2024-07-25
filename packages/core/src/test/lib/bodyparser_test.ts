import {describe as suite, test} from 'node:test';
import * as assert from 'node:assert';
import request from 'supertest';
import {App} from '../../index.js';

suite('Bodyparser', () => {
  test('can parse a JSON body', async () => {
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
