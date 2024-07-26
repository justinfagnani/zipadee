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
      .expect(`import '/__root__/node_modules/foo/index.js';\n`);

    // File outside of base
    await request(app.server)
      .get('/__root__/node_modules/foo/index.js')
      .expect(200)
      .expect('Content-Type', /javascript/)
      .expect(`import '/__root__/node_modules/bar/index.js';\n`);
  });

  test('skips non .js files', async () => {
    using app = new App();
    app.use(serve({root: 'test/fixtures/', base: 'base'}));

    await request(app.server).get('/hello.txt').expect(404);
  });

  test('can be mounted', async () => {
    using app = new App();
    app.use(mount('/js', serve({root: 'test/fixtures/', base: 'base'})));

    // File within base
    await request(app.server)
      .get('/js/hello.js')
      .expect(200)
      .expect('Content-Type', /javascript/)
      .expect(`import '/__root__/node_modules/foo/index.js';\n`);

    // File outside of base
    await request(app.server)
      .get('/js/__root__/node_modules/foo/index.js')
      .expect(200)
      .expect('Content-Type', /javascript/)
      .expect(`import '/__root__/node_modules/bar/index.js';\n`);
  });

  test('disallows resolved paths outside of root', async () => {
    using app = new App();
    app.use(serve({root: 'test/fixtures/', base: 'base'}));

    await request(app.server).get('/bad.js').expect(500);
  });
});
