import {describe as suite, test} from 'node:test';
import request from 'supertest';
import {App, mount} from '@zipadee/core';
import {serveTRPC} from '../index.js';
import {initTRPC} from '@trpc/server';

const users = [
  {id: 1, name: 'Bob'},
  {id: 2, name: 'Alice'},
];

const trpc = initTRPC.create();
const trpcRouter = trpc.router({
  user: trpc.procedure
    .input(Number)
    .output(Object)
    .query((req) => {
      return users.find((user) => req.input === user.id);
    }),
});

suite('tRPC adapter', () => {
  test('simple request', async () => {
    using app = new App();
    app.use(mount('/trpc/', serveTRPC({router: trpcRouter})));

    await request(app.server)
      .get('/trpc/user?input=1')
      .type('json')
      .expect(200)
      .expect({result: {data: {id: 1, name: 'Bob'}}});
  });
});
