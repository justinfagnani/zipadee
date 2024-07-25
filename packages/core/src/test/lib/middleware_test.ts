import {describe as suite, test} from 'node:test';
// import * as assert from 'node:assert';
import {mount} from '../../lib/middleware.js';
import {App} from '../../lib/app.js';
import request from 'supertest';

suite('middleware', () => {
  suite('mount()', () => {
    test('mount() prefix without trailing slash', async () => {
      using app = new App();
      app.use(
        mount('/foo', async (req, res, _next) => {
          res.body = req.path;
        }),
      );

      await app.listen();

      await request(app.server).get('/').expect(404);
      await request(app.server).get('/bar').expect(404);
      await request(app.server).get('/foo').expect(200).expect('/');
      await request(app.server).get('/foo/').expect(200).expect('/');
      await request(app.server).get('/foo/bar').expect(200).expect('/bar');
      await request(app.server).get('/foobar').expect(404);
    });
  });

  test('mount() prefix with trailing slash', async () => {
    using app = new App();
    app.use(
      mount('/foo/', async (req, res, _next) => {
        res.body = req.path;
      }),
    );

    await app.listen();

    await request(app.server).get('/').expect(404);
    await request(app.server).get('/bar').expect(404);
    await request(app.server).get('/foo').expect(404);
    await request(app.server).get('/foo/').expect(200).expect('/');
    await request(app.server).get('/foo/bar').expect(200).expect('/bar');
  });

  test('mount() restores path for up and downstream middleware', async () => {
    using app = new App();
    app.use(async (req, res, next) => {
      res.body = `A1:${req.path},`;
      await next();
      res.body += `A2:${req.path}`;
    });
    app.use(
      mount('/foo/', async (req, res, next) => {
        res.body += `B1:${req.path},`;
        await next();
        res.body += `B2:${req.path},`;
      }),
    );
    app.use(async (req, res, _next) => {
      res.body += `C:${req.path},`;
    });

    await app.listen();

    // These don't hit the mounted middleware
    await request(app.server).get('/').expect(200).expect('A1:/,C:/,A2:/');
    await request(app.server)
      .get('/bar')
      .expect(200)
      .expect('A1:/bar,C:/bar,A2:/bar');
    await request(app.server)
      .get('/foo')
      .expect(200)
      .expect('A1:/foo,C:/foo,A2:/foo');

    // These do hit the mounted middleware
    await request(app.server)
      .get('/foo/')
      .expect(200)
      .expect('A1:/foo/,B1:/,C:/foo/,B2:/,A2:/foo/');
    await request(app.server)
      .get('/foo/bar')
      .expect(200)
      .expect('A1:/foo/bar,B1:/bar,C:/foo/bar,B2:/bar,A2:/foo/bar');
  });
});
