import {describe as suite, test} from 'node:test';
import * as assert from 'node:assert';
import request from 'supertest';
import {App} from '../../lib/app.js';
import {HttpError} from '../../lib/http-error.js';

suite('App error handling', () => {
  test('sends privateMessage and stack in devMode for HttpError', async () => {
    using app = new App({dev: true});
    app.use((_req, _res, _next) => {
      throw new HttpError(500, 'Public', 'Private details');
    });
    const response = await request(app.server).get('/');
    assert.equal(response.status, 500);
    assert.match(response.text, /Public/);
    assert.match(response.text, /Private details/);
    assert.match(response.text, /at /); // stack trace
  });

  test('does not send privateMessage or stack in prod mode for HttpError', async () => {
    using app = new App({dev: false});
    app.use((_req, _res, _next) => {
      throw new HttpError(500, 'Public', 'Private details');
    });
    const response = await request(app.server).get('/');
    assert.equal(response.status, 500);
    assert.match(response.text, /Public/);
    assert.doesNotMatch(response.text, /Private details/);
    assert.doesNotMatch(response.text, /at /); // stack trace
  });

  test('sends stack and message for generic Error in devMode', async () => {
    using app = new App({dev: true});
    app.use((_req, _res, _next) => {
      throw new Error('Oops!');
    });
    const response = await request(app.server).get('/');
    assert.equal(response.status, 500);
    assert.match(response.text, /Internal Server Error/);
    assert.match(response.text, /Oops!/);
    assert.match(response.text, /at /); // stack trace
  });

  test('does not send stack for HttpError 4xx in prod', async () => {
    using app = new App();
    app.use((_req, _res, _next) => {
      throw new HttpError(404, 'Not found', 'Should not leak');
    });
    const response = await request(app.server).get('/');
    assert.equal(response.status, 404);
    assert.match(response.text, /Not found/);
    assert.doesNotMatch(response.text, /Should not leak/);
    assert.doesNotMatch(response.text, /at /); // stack trace
  });

    test('does send stack for HttpError 4xx in dev', async () => {
    using app = new App({dev: true});
    app.use((_req, _res, _next) => {
      throw new HttpError(404, 'Not found', 'Should not leak');
    });
    const response = await request(app.server).get('/');
    assert.equal(response.status, 404);
    assert.match(response.text, /Not found/);
    assert.match(response.text, /Should not leak/);
    assert.match(response.text, /at /); // stack trace
  });
});
