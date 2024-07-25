import {App} from '@zipadee/core';
// import * as path from 'node:path';
import {describe as suite, test} from 'node:test';
import request from 'supertest';
import {serve} from '../index.js';

// Tests need to be ported from https://github.com/koajs/static/blob/master/test/index.js

suite('serve()', () => {
  test('serves files', async () => {
    using app = new App();
    app.use(serve('test/fixtures', {root: 'test/fixtures'}));
    await request(app.server)
      .get('/hello.txt')
      .expect(200)
      .expect('Content-Type', /text/)
      .expect('world');
    await request(app.server)
      .get('/world/')
      .expect(200)
      .expect('Content-Type', /html/)
      .expect('html index\n');
  });
});
