# @zipadee/compress

Response compression middleware for Zipadee. Automatically compresses response
bodies using gzip, deflate, or Brotli based on client preferences.

## Installation

```bash
npm install @zipadee/compress
```

## Usage

```typescript
import {App} from '@zipadee/core';
import {compress} from '@zipadee/compress';

const app = new App();

// Use compression middleware
app.use(compress());

// Your routes
app.use(async (req, res) => {
  res.body = 'Hello World!'.repeat(1000);
});
```

## Features

- **Content Negotiation**: Chooses the best encoding based on on
  `Accept-Encoding` header
- **Multiple Algorithms**: Supports Brotli, gzip, and deflate compression
- **Configurable Threshold**: Only compresses responses above a certain size
- **MIME Type Filtering**: Only compresses compressible content types by default
- **Stream Support**: Efficiently compresses streaming responses
- **Cache-Control support**: Respects `Cache-Control: no-transform` directive

## API

### `compress(options?: CompressOptions): Middleware`

Creates a compression middleware with the specified options.

#### Options

```typescript
interface CompressOptions {
  /**
   * Filter function to determine if content should be compressed.
   * Defaults to the compressible module which checks MIME types.
   */
  filter?: (contentType: string) => boolean;

  /**
   * Minimum response size in bytes to compress.
   * Default: 1024
   */
  threshold?: number;

  /**
   * Default encoding to use when no Accept-Encoding header is present.
   * Default: 'identity' (no compression)
   * Set to '*' to enable compression by default.
   */
  defaultEncoding?: string;

  /**
   * Options for gzip compression.
   * Set to false to disable gzip.
   */
  gzip?: ZlibOptions | false;

  /**
   * Options for deflate compression.
   * Set to false to disable deflate.
   */
  deflate?: ZlibOptions | false;

  /**
   * Options for Brotli compression.
   * Set to false to disable Brotli.
   */
  br?: BrotliOptions | false;
}
```

## Examples

### Basic Usage

```typescript
import {App} from '@zipadee/core';
import {compress} from '@zipadee/compress';

const app = new App();

app.use(compress());

app.use(async (req, res) => {
  res.type = 'text/html';
  res.body = '<html><body>Hello World!</body></html>'.repeat(100);
});
```

### Custom Threshold

Only compress responses larger than 2KB (2048 bytes):

```typescript
app.use(compress({
  threshold: 2048
}));
```

### Custom Filter

Only compress JSON responses:

```typescript
app.use(compress({
  filter: (contentType) => contentType.startsWith('application/json')
}));
```

### Disable Specific Encodings

Disable Brotli compression:

```typescript
app.use(compress({
  br: false  // Only use gzip and deflate
}));
```

### Custom Compression Options

Set maximum compression level for gzip:

```typescript
app.use(compress({
  gzip: {
    level: 9  // Maximum compression (slower, smaller)
  }
}));
```

Configure Brotli compression quality:

```typescript
app.use(compress({
  br: {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 4  // Lower quality (faster)
    }
  }
}));
```

### Enable Compression by Default

Compress responses even when client doesn't specify Accept-Encoding:

```typescript
app.use(compress({
  defaultEncoding: '*'  // Use gzip as default
}));
```

## How It Works

1. **Content Negotiation**: The middleware examines the `Accept-Encoding` header
   to determine which compression algorithms the client supports.

2. **Filtering**: It checks if the response should be compressed based on:
   - Content-Type (only compressible types like text/html, application/json)
   - Response size (must meet the threshold)
   - Cache-Control header (respects `no-transform`)
   - HTTP method (skips HEAD requests)
   - Status code (skips 204, 205, 304)

3. **Compression**: If compression is appropriate:
   - For non-stream bodies (strings, buffers): Compresses synchronously and sets
     as Buffer
   - For stream bodies: Pipes through a compression transform stream

4. **Headers**: Sets appropriate headers:
   - `Content-Encoding`: The chosen compression algorithm
   - `Vary: Accept-Encoding`: Indicates compression varies by encoding
   - Removes `Content-Length`: Since compressed size differs

## Performance Considerations

- **Synchronous Compression**: Non-stream bodies are compressed synchronously
  using `gzipSync`, `deflateSync`, or `brotliCompressSync`. This is efficient
  for reasonably-sized responses.

- **Streaming Compression**: Large responses or streams are compressed using
  transform streams, allowing data to flow without buffering the entire response
  in memory.

- **Threshold**: The default 1KB threshold prevents wasting CPU cycles
  compressing tiny responses that won't benefit from compression. This is based
  on the response's content size, so be sure to set it.

- **Brotli Quality**: The default Brotli quality level is 4 (lower than the max
  of 11) to balance compression ratio with speed.

## Compatibility

This middleware is designed for Zipadee's architecture where:
- Middleware runs in order and can modify the response after downstream
  middleware
- The `Response.body` property can be set to strings, Buffers, or Streams
- The `Response.respond()` method handles different body types appropriately

## License

MIT

## Credits

Inspired by [koa-compress](https://github.com/koajs/compress) but adapted for
Zipadee's middleware model.
