# @zipadee/cors

CORS middleware for the Zipadee web server.

> [!CAUTION]
>
> Zipadee is very early, under construction, will change a lot, and may never be
> sufficiently maintained for any level of use. If you want to try it, please
> consider contributing!

## Usage

```ts
import {App} from '@zipadee/core';
import {cors} from '@zipadee/cors';

const app = new App();
app.use(cors());

app.use(async (req, res) => {});
app.listen();
```
