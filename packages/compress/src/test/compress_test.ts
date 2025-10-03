import {App, html} from '@zipadee/core';
import * as assert from 'node:assert';
import {createReadStream} from 'node:fs';
import {describe as suite, test} from 'node:test';
import {fileURLToPath} from 'node:url';
import request from 'supertest';
import {compress} from '../index.js';

const __filename = fileURLToPath(import.meta.url);

suite('compress()', () => {
  suite('default options', () => {
    test('should compress text/html with gzip', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect('Content-Encoding', 'gzip')
        .expect(200);

      // supertest automatically decompresses gzip responses
      assert.equal(
        response.text,
        '<html><body>Hello World!</body></html>'.repeat(100),
      );
    });

    test('should compress with brotli when preferred', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'br, gzip')
        .expect('Content-Encoding', 'br')
        .expect(200);

      // supertest automatically decompresses brotli responses
      assert.equal(
        response.text,
        '<html><body>Hello World!</body></html>'.repeat(100),
      );
    });

    test('should not compress if body is below threshold', async () => {
      using app = new App();
      app.use(compress({threshold: 1024}));
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = 'Small body';
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      assert.equal(response.headers['content-encoding'], undefined);
      assert.equal(response.text, 'Small body');
    });

    test('should compress if body is at threshold', async () => {
      using app = new App();
      app.use(compress({threshold: 10}));
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '0123456789';
      });

      await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect('Content-Encoding', 'gzip')
        .expect(200);
    });

    test('should not compress non-compressible content types', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.type = 'image/png';
        res.body = Buffer.alloc(10000);
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      assert.equal(response.headers['content-encoding'], undefined);
    });

    test('should not compress when no Accept-Encoding header', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      // Explicitly set Accept-Encoding to identity (no compression)
      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'identity')
        .expect(200);

      // Should not compress when identity encoding is requested
      assert.equal(response.headers['content-encoding'], undefined);
      assert.equal(
        response.text,
        '<html><body>Hello World!</body></html>'.repeat(100),
      );
    });

    test('should not compress if cache-control: no-transform', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.setHeader('Cache-Control', 'no-transform');
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      assert.equal(response.headers['content-encoding'], undefined);
    });

    test('should compress streams', async () => {
      using app = new App();
      app.use(compress({threshold: 0}));
      app.use(async (_req, res) => {
        res.type = 'text/plain';
        res.body = createReadStream(__filename);
      });

      await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect('Content-Encoding', 'gzip')
        .expect(200);
    });

    test('should compress html tagged templates', async () => {
      using app = new App();
      app.use(compress({threshold: 0}));
      app.use(async (_req, res) => {
        res.body = html`<html><body>${'Hello World!'.repeat(100)}</body></html>`;
      });

      await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect('Content-Type', 'text/html; charset=utf-8')
        .expect('Content-Encoding', 'gzip')
        .expect(200);
    });

    test('should set Vary header', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect('Vary', 'Accept-Encoding')
        .expect(200);
    });

    test('should append to existing Vary header', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.setHeader('Vary', 'Accept-Language');
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      assert.equal(
        response.headers['vary'],
        'Accept-Language, Accept-Encoding',
      );
    });

    test('should not compress empty body status codes', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.statusCode = 204;
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect(204);

      assert.equal(response.headers['content-encoding'], undefined);
    });

    test('should not compress 304 responses', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.statusCode = 304;
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect(304);

      assert.equal(response.headers['content-encoding'], undefined);
    });

    test('should handle identity encoding (no compression)', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'identity')
        .expect(200);

      assert.equal(response.headers['content-encoding'], undefined);
      assert.equal(
        response.text,
        '<html><body>Hello World!</body></html>'.repeat(100),
      );
    });
  });

  suite('options.filter', () => {
    test('should use custom filter function', async () => {
      using app = new App();
      app.use(
        compress({
          filter: (contentType) => contentType.startsWith('application/json'),
        }),
      );
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      assert.equal(response.headers['content-encoding'], undefined);
    });

    test('should compress when filter returns true', async () => {
      using app = new App();
      app.use(
        compress({
          filter: (contentType) => contentType.startsWith('text/'),
        }),
      );
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect('Content-Encoding', 'gzip')
        .expect(200);
    });
  });

  suite('selective encoding', () => {
    test('should disable specific encodings', async () => {
      using app = new App();
      app.use(
        compress({
          br: false, // Disable brotli
        }),
      );
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      // Request br and gzip, but br is disabled so should use gzip
      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'br, gzip')
        .expect('Content-Encoding', 'gzip')
        .expect(200);

      // supertest automatically decompresses
      assert.equal(
        response.text,
        '<html><body>Hello World!</body></html>'.repeat(100),
      );
    });

    test('should not compress if requested encoding is disabled', async () => {
      using app = new App();
      app.use(
        compress({
          gzip: false,
          br: false,
        }),
      );
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      // Request gzip but it's disabled
      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      assert.equal(response.headers['content-encoding'], undefined);
    });
  });

  suite('encoding options', () => {
    test('should pass gzip options', async () => {
      using app = new App();
      app.use(
        compress({
          gzip: {
            level: 9, // Maximum compression
          },
        }),
      );
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect('Content-Encoding', 'gzip')
        .expect(200);

      // supertest automatically decompresses
      assert.equal(
        response.text,
        '<html><body>Hello World!</body></html>'.repeat(100),
      );
    });

    test('should pass brotli options', async () => {
      using app = new App();
      app.use(
        compress({
          br: {
            params: {
              // Brotli quality level
            },
          },
        }),
      );
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'br')
        .expect('Content-Encoding', 'br')
        .expect(200);

      // supertest automatically decompresses
      assert.equal(
        response.text,
        '<html><body>Hello World!</body></html>'.repeat(100),
      );
    });

    test('should disable encoding with false', async () => {
      using app = new App();
      app.use(
        compress({
          gzip: false,
          br: false,
        }),
      );
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip, br')
        .expect(200);

      assert.equal(response.headers['content-encoding'], undefined);
    });
  });

  suite('edge cases', () => {
    test('should handle missing content-type', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Should not compress without content-type
      assert.equal(response.headers['content-encoding'], undefined);
    });

    test('should handle null body', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.statusCode = 200;
      });

      const response = await request(app.server)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      assert.equal(response.headers['content-encoding'], undefined);
    });

    test('should handle HEAD requests', async () => {
      using app = new App();
      app.use(compress());
      app.use(async (_req, res) => {
        res.type = 'text/html';
        res.body = '<html><body>Hello World!</body></html>'.repeat(100);
      });

      const response = await request(app.server)
        .head('/')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // HEAD should not compress (middleware skips HEAD requests)
      assert.equal(response.headers['content-encoding'], undefined);
      // HEAD response should have no body
      assert.equal(Object.keys(response.body).length, 0);
    });
  });
});
