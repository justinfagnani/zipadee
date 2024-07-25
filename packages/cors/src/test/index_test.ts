import {describe as suite, test} from 'node:test';
import * as assert from 'node:assert';
import request from 'supertest';
import {App} from '@zipadee/core';
import {cors} from '../index.js';

// Most tests here ported from https://github.com/koajs/cors/blob/master/test/cors.test.js

suite('cors()', () => {
  suite('default options', () => {
    const app = new App();
    app.use(cors());
    app.use(async (_req, res, _next) => {
      res.body = 'Hello World!';
    });

    test('should set `Access-Control-Allow-Origin` to `*` when request Origin header missing', async () => {
      const response = await request(app.server).get('/');

      assert.equal(response.text, 'Hello World!');
      assert.equal(response.headers['access-control-allow-origin'], '*');
      assert.equal(response.statusCode, 200);
    });

    test('should set `Access-Control-Allow-Origin` to `*`', async () => {
      await request(app.server)
        .get('/')
        .set('Origin', 'http://zipadee.dev')
        .expect('Access-Control-Allow-Origin', '*')
        .expect('Hello World!')
        .expect(200);
    });

    test('should 204 on Preflight Request', async () => {
      const app = new App();
      app.use(cors());
      let called = false;
      app.use(async (_req, res, _next) => {
        res.body = 'Hello World!';
        called = true;
      });

      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Allow-Origin', '*')
        .expect(
          'Access-Control-Allow-Methods',
          'GET,HEAD,PUT,POST,DELETE,PATCH',
        )
        .expect(204);

      // Check if next middleware was called
      assert.equal(called, false);
    });

    test('should not Preflight Request if request missing Access-Control-Request-Method', async () => {
      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .expect(200);
    });

    // Note: This differs from koa-cors. My reading of CORS docs is that Vary
    // must be set when Access-Control-Allow-Origin is present, but not if its
    // value is '*':
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin#cors_and_caching
    test('should not set `Vary` to Origin', async () => {
      const response = await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Hello World!')
        .expect('Access-Control-Allow-Origin', '*')
        .expect(200);
      assert.equal(response.headers['vary'], null);
    });
  });

  suite('options.origin=*', function () {
    const app = new App();
    app.use(
      cors({
        origin: '*',
      }),
    );
    app.use((_req, res) => {
      res.body = 'Hello World!';
    });

    test('should always set `Access-Control-Allow-Origin` to *', async () => {
      await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Allow-Origin', '*')
        .expect('Hello World!')
        .expect(200);
    });

    test('should always set `Access-Control-Allow-Origin` to *, even if no Origin is passed on request', async () => {
      await request(app.server)
        .get('/')
        .expect('Access-Control-Allow-Origin', '*')
        .expect('Hello World!')
        .expect(200);
    });
  });

  suite('options.origin set the request Origin header', function () {
    const app = new App();
    app.use(
      cors({
        origin: (req) => req.getSingleHeader('Origin') ?? '*',
      }),
    );
    app.use((_req, res) => {
      res.body = 'Hello World!';
    });

    test('should set `Access-Control-Allow-Origin` to request `Origin` header', async () => {
      await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Allow-Origin', 'http://koajs.com')
        .expect('Hello World!')
        .expect(200);
    });

    test('should set `Access-Control-Allow-Origin` to request `origin` header', async () => {
      await request(app.server)
        .get('/')
        .set('Origin', 'http://origin.koajs.com')
        .expect('Access-Control-Allow-Origin', 'http://origin.koajs.com')
        .expect('Hello World!')
        .expect(200);
    });

    test('should set `Access-Control-Allow-Origin` to `*`, even if no Origin is passed on request', async () => {
      await request(app.server)
        .get('/')
        .expect('Access-Control-Allow-Origin', '*')
        .expect('Hello World!')
        .expect(200);
    });
  });

  suite('options.secureContext=true', function () {
    const app = new App();
    app.use(
      cors({
        secureContext: true,
      }),
    );
    app.use((_req, res) => {
      res.body = 'Hello World!';
    });

    test('should always set `Cross-Origin-Opener-Policy` & `Cross-Origin-Embedder-Policy` on not OPTIONS', async () => {
      await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Cross-Origin-Opener-Policy', 'same-origin')
        .expect('Cross-Origin-Embedder-Policy', 'require-corp')
        .expect('Hello World!')
        .expect(200);
    });

    test('should always set `Cross-Origin-Opener-Policy` & `Cross-Origin-Embedder-Policy` on OPTIONS', async () => {
      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Cross-Origin-Opener-Policy', 'same-origin')
        .expect('Cross-Origin-Embedder-Policy', 'require-corp')
        .expect(204);
    });
  });

  suite('options.secureContext=false', function () {
    const app = new App();
    app.use(
      cors({
        secureContext: false,
      }),
    );
    app.use((_req, res) => {
      res.body = 'Hello World!';
    });

    test('should not set `Cross-Origin-Opener-Policy` & `Cross-Origin-Embedder-Policy`', async () => {
      await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect((res) => {
          assert.strictEqual(
            !('Cross-Origin-Opener-Policy' in res.headers),
            true,
          );
          assert.strictEqual(
            !('Cross-Origin-Embedder-Policy' in res.headers),
            true,
          );
        })
        .expect('Hello World!')
        .expect(200);
    });
  });

  suite('options.origin=function', function () {
    const app = new App();
    app.use(
      cors({
        origin: (req) => (req.url?.pathname === '/forbin' ? false : '*'),
      }),
    );
    app.use((_req, res) => {
      res.body = 'Hello World!';
    });

    test('should disable cors', async () => {
      await request(app.server)
        .get('/forbin')
        .set('Origin', 'http://koajs.com')
        .expect('Hello World!')
        .expect((res) => {
          assert.equal(!res.headers['access-control-allow-origin'], true);
        })
        .expect(200);
    });

    test('should set access-control-allow-origin to *', async () => {
      await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Hello World!')
        .expect('Access-Control-Allow-Origin', '*')
        .expect(200);
    });
  });

  suite('options.origin=promise', function () {
    const app = new App();
    app.use(
      cors({
        origin: async (req) => {
          await 0;
          if (req.url?.pathname === '/forbin') {
            return false;
          }
          return '*';
        },
      }),
    );
    app.use((_req, res) => {
      res.body = 'Hello World!';
    });

    test('should disable cors', async () => {
      await request(app.server)
        .get('/forbin')
        .set('Origin', 'http://koajs.com')
        .expect('Hello World!')
        .expect(200)
        .expect((res) => {
          assert.equal(!res.headers['access-control-allow-origin'], true);
        });
    });

    test('should set access-control-allow-origin to *', async () => {
      await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Hello World!')
        .expect('Access-Control-Allow-Origin', '*')
        .expect(200);
    });
  });

  suite('options.exposeHeaders', function () {
    test('should Access-Control-Expose-Headers: `content-length`', async () => {
      const app = new App();
      app.use(
        cors({
          exposeHeaders: 'content-length',
        }),
      );
      app.use((_req, res) => {
        res.body = 'Hello World!';
      });

      await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Expose-Headers', 'content-length')
        .expect('Hello World!')
        .expect(200);
    });

    test('should work with array', async () => {
      const app = new App();
      app.use(
        cors({
          exposeHeaders: ['content-length', 'x-header'],
        }),
      );
      app.use((_req, res) => {
        res.body = 'Hello World!';
      });

      await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Expose-Headers', 'content-length,x-header')
        .expect('Hello World!')
        .expect(200);
    });
  });

  suite('options.maxAge', () => {
    test('should set maxAge with number', async () => {
      const app = new App();
      app.use(
        cors({
          maxAge: 3600,
        }),
      );
      app.use((_req, res) => {
        res.body = 'Hello World!';
      });

      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Max-Age', '3600')
        .expect(204);
    });

    test('should set maxAge with string', async () => {
      const app = new App();
      app.use(
        cors({
          maxAge: '3600',
        }),
      );
      app.use((_req, res) => {
        res.body = 'Hello World!';
      });

      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Max-Age', '3600')
        .expect(204);
    });

    test('should not set maxAge on simple request', async () => {
      const app = new App();
      app.use(
        cors({
          maxAge: '3600',
        }),
      );
      app.use((_req, res) => {
        res.body = 'Hello World!';
      });

      await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Hello World!')
        .expect(200)
        .expect((res) => {
          assert.equal(!res.headers['access-control-max-age'], true);
        });
    });
  });

  suite('options.credentials', function () {
    const app = new App();
    app.use(
      cors({
        origin(request) {
          return request.getSingleHeader('Origin') ?? false;
        },
        credentials: true,
      }),
    );
    app.use((_req, res) => {
      res.body = 'Hello World!';
    });

    test('should enable Access-Control-Allow-Credentials on Simple request', async () => {
      await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Allow-Credentials', 'true')
        .expect('Hello World!')
        .expect(200);
    });

    test('should enable Access-Control-Allow-Credentials on Preflight request', async () => {
      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect('Access-Control-Allow-Credentials', 'true')
        .expect(204);
    });

    test('should not set Access-Control-Allow-Credentials with default origin', async () => {
      const app = new App();
      app.use(
        cors({
          credentials: true,
        }),
      );
      app.use((_req, res) => {
        res.body = 'Hello World!';
      });
      const response = await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Hello World!')
        .expect(200);

      assert.equal(
        response.headers['access-control-allow-credentials'],
        undefined,
      );
    });
  });

  suite('options.credentials unset', function () {
    const app = new App();
    app.use(cors());
    app.use((_req, res) => {
      res.body = 'Hello World!';
    });

    test('should disable Access-Control-Allow-Credentials on Simple request', async () => {
      const response = await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Hello World!')
        .expect(200);
      assert.equal(
        response.headers['access-control-allow-credentials'],
        undefined,
      );
      // .end(function(error, response) {
      //   if (error) return done(error);

      //   const header = response.headers['access-control-allow-credentials'];
      //   assert.equal(header, undefined, 'Access-Control-Allow-Credentials must not be set.');
      //   done();
      // });
    });

    test('should disable Access-Control-Allow-Credentials on Preflight request', async () => {
      const response = await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect(204);
      assert.equal(
        response.headers['access-control-allow-credentials'],
        undefined,
      );

      // .end(function(error, response) {
      //   if (error) return done(error);

      //   const header = response.headers['access-control-allow-credentials'];
      //   assert.equal(header, undefined, 'Access-Control-Allow-Credentials must not be set.');
      //   done();
      // });
    });
  });

  suite('options.credentials=function', function () {
    const app = new App();
    app.use(
      cors({
        origin(request) {
          return request.getSingleHeader('Origin') ?? false;
        },
        credentials(req) {
          return req.url?.pathname !== '/forbin';
        },
      }),
    );
    app.use((_req, res) => {
      res.body = 'Hello World!';
    });

    test('should enable Access-Control-Allow-Credentials on Simple request', async () => {
      await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Allow-Credentials', 'true')
        .expect('Hello World!')
        .expect(200);
    });

    test('should enable Access-Control-Allow-Credentials on Preflight request', async () => {
      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect('Access-Control-Allow-Credentials', 'true')
        .expect(204);
    });

    test('should disable Access-Control-Allow-Credentials on Simple request', async () => {
      const response = await request(app.server)
        .get('/forbin')
        .set('Origin', 'http://koajs.com')
        .expect('Hello World!')
        .expect(200);
      assert.equal(
        response.headers['access-control-allow-credentials'],
        undefined,
      );

      // .end(function(error, response) {
      //   if (error) return done(error);

      //   const header = response.headers['access-control-allow-credentials'];
      //   assert.equal(header, undefined, 'Access-Control-Allow-Credentials must not be set.');
      //   done();
      // });
    });

    test('should disable Access-Control-Allow-Credentials on Preflight request', async () => {
      const response = await request(app.server)
        .options('/forbin')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect(204);
      assert.equal(
        response.headers['access-control-allow-credentials'],
        undefined,
      );

      // .end(function(error, response) {
      //   if (error) return done(error);

      //   const header = response.headers['access-control-allow-credentials'];
      //   assert.equal(header, undefined, 'Access-Control-Allow-Credentials must not be set.');
      //   done();
      // });
    });
  });

  suite('options.credentials=async function', function () {
    const app = new App();
    app.use(
      cors({
        origin(request) {
          return request.getSingleHeader('Origin') ?? false;
        },
        async credentials() {
          return true;
        },
      }),
    );
    app.use((_req, res) => {
      res.body = 'Hello World!';
    });

    test('should enable Access-Control-Allow-Credentials on Simple request', async () => {
      await request(app.server)
        .get('/')
        .set('Origin', 'http://koajs.com')
        .expect('Access-Control-Allow-Credentials', 'true')
        .expect('Hello World!')
        .expect(200);
    });

    test('should enable Access-Control-Allow-Credentials on Preflight request', async () => {
      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'DELETE')
        .expect('Access-Control-Allow-Credentials', 'true')
        .expect(204);
    });
  });

  suite('options.allowHeaders', () => {
    test('should work with allowHeaders is string', async () => {
      const app = new App();
      app.use(
        cors({
          allowHeaders: 'X-PINGOTHER',
        }),
      );
      app.use((_req, res) => {
        res.body = 'Hello World!';
      });

      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Allow-Headers', 'X-PINGOTHER')
        .expect(204);
    });

    test('should work with allowHeaders is array', async () => {
      const app = new App();
      app.use(
        cors({
          allowHeaders: ['X-PINGOTHER'],
        }),
      );
      app.use((_req, res) => {
        res.body = 'Hello World!';
      });

      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Allow-Headers', 'X-PINGOTHER')
        .expect(204);
    });

    test('should set Access-Control-Allow-Headers to request access-control-request-headers header', async () => {
      const app = new App();
      app.use(cors());
      app.use((_req, res) => {
        res.body = 'Hello World!';
      });

      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .set('access-control-request-headers', 'X-PINGOTHER')
        .expect('Access-Control-Allow-Headers', 'X-PINGOTHER')
        .expect(204);
    });
  });

  suite('options.allowMethods', () => {
    test('should work with allowMethods is array', async () => {
      const app = new App();
      app.use(
        cors({
          allowMethods: ['GET', 'POST'],
        }),
      );
      app.use((_req, res) => {
        res.body = 'Hello World!';
      });

      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect('Access-Control-Allow-Methods', 'GET,POST')
        .expect(204);
    });

    test('should skip allowMethods', async () => {
      const app = new App();
      app.use(
        cors({
          allowMethods: null,
        }),
      );
      app.use((_req, res) => {
        res.body = 'Hello World!';
      });

      await request(app.server)
        .options('/')
        .set('Origin', 'http://koajs.com')
        .set('Access-Control-Request-Method', 'PUT')
        .expect(204);
    });
  });

  // describe('options.headersKeptOnError', () => {
  //   it('should keep CORS headers after an error', async () => {
  //     const app = new App();
  //     app.use(
  //       cors({
  //         origin(req) {
  //           return req.getSingleHeader('Origin') || '*';
  //         },
  //       }),
  //     );
  //     app.use((_req, res) => {
  //       res.body = 'Hello World!';
  //       throw new Error('Whoops!');
  //     });

  //     await request(app.server)
  //       .get('/')
  //       .set('Origin', 'http://koajs.com')
  //       .expect('Access-Control-Allow-Origin', 'http://koajs.com')
  //       .expect('Vary', 'Origin')
  //       .expect(/Error/)
  //       .expect(500);
  //   });

  //   it('should not affect OPTIONS requests', async () => {
  //     const app = new App();
  //     app.use(
  //       cors({
  //         origin(req) {
  //           return req.getSingleHeader('Origin') || '*';
  //         },
  //       }),
  //     );
  //     app.use((_req, res) => {
  //       res.body = 'Hello World!';
  //       throw new Error('Whoops!');
  //     });

  //     await request(app.server)
  //       .options('/')
  //       .set('Origin', 'http://koajs.com')
  //       .set('Access-Control-Request-Method', 'PUT')
  //       .expect('Access-Control-Allow-Origin', 'http://koajs.com')
  //       .expect(204);
  //   });

  //   it('should not keep unrelated headers', async () => {
  //     const app = new App();
  //     app.use(
  //       cors({
  //         origin(req) {
  //           return req.getSingleHeader('Origin') || '*';
  //         },
  //       }),
  //     );
  //     app.use((_req, res) => {
  //       res.body = 'Hello World!';
  //       res.setHeader('X-Example', 'Value');
  //       throw new Error('Whoops!');
  //     });

  //     const response = await request(app.server)
  //       .get('/')
  //       .set('Origin', 'http://koajs.com')
  //       .expect('Access-Control-Allow-Origin', 'http://koajs.com')
  //       .expect(/Error/)
  //       .expect(500);
  //     assert.equal(response.headers['x-example'], undefined);
  //   });

  //   it('should not keep CORS headers after an error if keepHeadersOnError is false', async () => {
  //     const app = new App();
  //     app.use(
  //       cors({
  //         keepHeadersOnError: false,
  //       }),
  //     );
  //     app.use((_req, res) => {
  //       res.body = 'Hello World!';
  //       throw new Error('Whoops!');
  //     });

  //     const response = await request(app.server)
  //       .get('/')
  //       .set('Origin', 'http://koajs.com')
  //       .expect(/Error/)
  //       .expect(500);
  //     assert.equal(response.headers['access-control-allow-origin'], undefined);
  //     assert.equal(response.headers.vary, undefined);
  //   });
  // });
});
