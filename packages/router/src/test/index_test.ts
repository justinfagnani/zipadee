import {describe as suite, test} from 'node:test';
import request from 'supertest';
import {App} from '@zipadee/core';
import {Router} from '../index.js';

suite('Router', () => {
  test('simple paths', async () => {
    using app = new App();
    const router = new Router();
    router.get('/', async (_req, res) => {
      res.body = 'root';
    });
    router.get('/foo', async (_req, res) => {
      res.body = 'foo';
    });
    router.get('/foo/bar', async (_req, res) => {
      res.body = 'foobar';
    });
    app.use(router.routes());

    await request(app.server).get('/').expect(200).expect('root');
    await request(app.server).get('/foo').expect(200).expect('foo');
    await request(app.server).get('/foo/bar').expect(200).expect('foobar');
    await request(app.server).get('/foobar').expect(404);
  });

  test('params', async () => {
    using app = new App();
    const router = new Router();
    router.get('/foo/:abc', async (_req, res, _next, params) => {
      res.body = params.pathname.groups.abc;
    });
    app.use(router.routes());

    await request(app.server).get('/').expect(404);
    await request(app.server).get('/foo').expect(404);
    await request(app.server).get('/foo/bar').expect(200).expect('bar');
  });
});
