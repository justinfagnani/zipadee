# @zipadee/trpc

> [!CAUTION]
> Zipadee is very early, under construction, will change a lot, and may never be sufficiently maintained for any level of use. If you want to try it, please consider contributing!

## Usage

```ts
import {App, mount} from '@zipadee/core';
import {serveTRPC} from '@zipadee/trpc';
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

using app = new App();
app.use(mount('/trpc/', serveTRPC({router: trpcRouter})));
```
