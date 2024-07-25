import {App} from '@zipadee/core';
// import * as path from 'node:path';
import {describe as suite, test} from 'node:test';
import request from 'supertest';
import {send} from '../index.js';

// Tests need to be ported from https://github.com/koajs/send/blob/master/test/index.test.ts

suite('send()', () => {
  test('sends files', async () => {
    using app = new App();
    app.use(async (req, res, _next) => {
      await send(req, res, 'hello.txt', {root: 'test/fixtures'});
    });

    await request(app.server).get('/').expect(200).expect('world');
  });

  // describe('with .root', () => {
  //   describe('when the path is absolute', () => {
  //     it('should 404', async () => {
  //       const app = new App();

  //       app.use(async (req, res) => {
  //         const opts = {root: 'test/fixtures'};
  //         await send(
  //           req,
  //           res,
  //           path.join(__dirname, '/fixtures/hello.txt'),
  //           opts,
  //         );
  //       });

  //       await app.listen();
  //       await request(app.server).get('/').expect(404);
  //     });
  //   });

  //   describe('when the path is relative and exists', () => {
  //     it('should serve the file', async () => {
  //       const app = new App();

  //       app.use(async (req, res) => {
  //         const opts = {root: 'test/fixtures'};
  //         await send(req, res, 'hello.txt', opts);
  //       });

  //       await app.listen();
  //       await request(app.server).get('/').expect(200).expect('world');
  //     });
  //   });

  //   describe('when the path is relative and does not exist', () => {
  //     it('should 404', async () => {
  //       const app = new App();

  //       app.use(async (req, res) => {
  //         const opts = {root: 'test/fixtures'};
  //         await send(req, res, 'something', opts);
  //       });

  //       await app.listen();
  //       await request(app.server).get('/').expect(404);
  //     });
  //   });

  //   describe('when the path resolves above the root', () => {
  //     it('should 403', async () => {
  //       const app = new App();

  //       app.use(async (req, res) => {
  //         const opts = {root: 'test/fixtures'};
  //         await send(req, res, '../../package.json', opts);
  //       });

  //       await app.listen();
  //       await request(app.server).get('/').expect(403);
  //     });
  //   });

  //   describe('when the path resolves within root', () => {
  //     it('should 403', async () => {
  //       const app = new App();

  //       app.use(async (req, res) => {
  //         const opts = {root: 'test/fixtures'};
  //         await send(req, res, '../../test/fixtures/world/index.html', opts);
  //       });

  //       await app.listen();
  //       await request(app.server).get('/').expect(403);
  //     });
  //   });
  // });
});
