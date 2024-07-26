import {describe as suite, test} from 'node:test';
import * as assert from 'node:assert';
import request from 'supertest';
import {App} from '../../lib/app.js';
import {HttpError} from '../../lib/http-error.js';

suite('App', () => {
  test('simple response', async () => {
    using app = new App();
    app.use(async (_req, res, _next) => {
      res.body = 'Hello World!';
    });

    await app.listen();

    const response = await request(app.server).get('/');

    assert.equal(response.status, 200);
    assert.equal(response.text, 'Hello World!');
  });

  test('default status is 404', async () => {
    using app = new App();

    await app.listen();

    const response = await request(app.server).get('/');

    assert.equal(response.status, 404);
  });

  test('Plain errors cause a 500 status', async () => {
    using app = new App();
    app.use(async (_req, _res, _next) => {
      throw new Error('Oops!');
    });
    await request(app.server).get('/').expect(500);
  });

  test('HttpError errors use their status and message', async () => {
    using app = new App();
    app.use(async (_req, _res, _next) => {
      throw new HttpError(403);
    });
    await request(app.server).get('/').expect(403).expect('Forbidden');
  });

  test('composes middleware', async () => {
    using app = new App();

    app.use(async (_req, res, next) => {
      res.write('A1');
      await next();
      res.write('A2');
    });

    app.use(async (_req, res, next) => {
      res.write('B1');
      await next();
      res.write('B2');
    });

    app.use(async (_req, res, _next) => {
      res.write('C');
    });

    await app.listen();

    const response = await request(app.server).get('/');

    assert.equal(response.text, 'A1B1CB2A2');
  });
});
