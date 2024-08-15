import {App, mount} from '@zipadee/core';
import {describe as suite, test} from 'node:test';
import request from 'supertest';
import {serve} from '../index.js';

suite('serve()', () => {
  test('resolves imports in .js files', async () => {
    using app = new App();
    app.use(serve({root: 'test/fixtures/', base: 'base'}));

    // File within base
    await request(app.server)
      .get('/hello.js')
      .expect(200)
      .expect('Content-Type', /javascript/)
      .expect(
        `import '/__root__/node_modules/foo/index.js';\nimport './good.js';\n`,
      );

    // File outside of base
    await request(app.server)
      .get('/__root__/node_modules/foo/index.js')
      .expect(200)
      .expect('Content-Type', /javascript/)
      .expect(`import '/__root__/node_modules/bar/index.js';\n`);
  });

  test('avoids bugs with confusing base and root', async () => {
    using app = new App();
    app.use(serve({root: 'test/fixtures/', base: 'base'}));

    // File with path that could be confused with base.
    await request(app.server)
      .get('/__root__/base.js')
      .expect(200)
      .expect('Content-Type', /javascript/)
      .expect(`console.log('hi');\n`);
  });

  test('resolves using package exports', async () => {
    using app = new App();
    app.use(serve({root: 'test/fixtures/', base: 'base'}));

    await request(app.server)
      .get('/uses-exports.js')
      .expect(200)
      .expect('Content-Type', /javascript/)
      .expect(`import '/__root__/node_modules/baz/a.mjs';\n`);
  });

  test('serves non .js files', async () => {
    using app = new App();
    app.use(serve({root: 'test/fixtures/', base: 'base'}));

    await request(app.server)
      .get('/hello.txt')
      .expect(200)
      .expect('Content-Type', /plain/);
  });

  test('can be mounted', async () => {
    using app = new App();
    app.use(mount('/js', serve({root: 'test/fixtures/', base: 'base'})));

    // File within base
    await request(app.server)
      .get('/js/hello.js')
      .expect(200)
      .expect('Content-Type', /javascript/)
      .expect(
        `import '/js/__root__/node_modules/foo/index.js';\nimport './good.js';\n`,
      );

    // File outside of base
    await request(app.server)
      .get('/js/__root__/node_modules/foo/index.js')
      .expect(200)
      .expect('Content-Type', /javascript/)
      .expect(`import '/js/__root__/node_modules/bar/index.js';\n`);
  });

  test('disallows resolved paths outside of root', async () => {
    using app = new App();
    app.use(serve({root: 'test/fixtures/', base: 'base'}));

    await request(app.server).get('/bad.js').expect(500);
  });

  test('resolves with import attributes', async () => {
    using app = new App();
    app.use(serve({root: 'test/fixtures/', base: 'base'}));

    await request(app.server)
      .get('/import-css.js')
      .expect(200)
      .expect('Content-Type', /javascript/)
      .expect(
        `import '/__root__/node_modules/foo/styles.css' with {type: 'css'};\n`,
      );

    await request(app.server)
      .get('/__root__/node_modules/foo/styles.css')
      .expect(200)
      .expect('Content-Type', /css/)
      .expect(`:root {\n  color: red;\n}\n`);
  });

  test.only('adds extensions', async () => {
    using app = new App();
    app.use(serve({root: 'test/fixtures/', base: 'base'}));

    await request(app.server)
      .get('/extensionless.js')
      .expect(200)
      .expect('Content-Type', /javascript/)
      .expect(`import './good.js';\nimport '/good.js';\n`);
  });
});
