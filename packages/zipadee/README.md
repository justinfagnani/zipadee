# zipadee

Zipadee is a web server for node.js.

> [!CAUTION]
> Zipadee is very early, under construction, will change a lot, and may never be sufficiently maintained for any level of use. If you want to try it, please consider contributing!

The `zipadee` package is a convenience wrapper around the Zipadee core library and several common middleware packages like `@ziapdee/cors`, `@ziapdee/router`, and `@zipadee/static`.

## Usage

```ts
import {App, Router, cors, send} from '@zipadee/core';

const app = new App();
const router = new Router();
router.get('/:file', async (req, res, next, params) => {
  const filePath = params.pathname.groups.file;
  await send(req, res, filePath, {root: 'files'});
});
app.use(cors());
app.use(router.routes());
app.listen();
```
