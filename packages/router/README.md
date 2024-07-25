# @zipadee/router

> [!CAUTION]
> Zipadee is very early, under construction, will change a lot, and may never be sufficiently maintained for any level of use. If you want to try it, please consider contributing!

## Usage

```ts
import {App, Router, cors, send} from '@zipadee/core';

const app = new App();
const router = new Router();
router.get('/greet/:name', async (req, res, next, params) => {
  const name = params.pathname.groups.name;
  res.body = `Hello, ${name}!`;
});
app.use(router.routes());

app.listen();
```
