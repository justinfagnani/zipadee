import {type AnyTRPCRouter} from '@trpc/server';
import {
  nodeHTTPRequestHandler,
  type NodeHTTPRequest,
  type NodeHTTPRequestHandlerOptions,
  type NodeHTTPResponse,
  type NodeHTTPHandlerOptions,
} from '@trpc/server/adapters/node-http';
import type {Middleware} from '@zipadee/core';

export type Options<TRouter extends AnyTRPCRouter> = Omit<
  NodeHTTPHandlerOptions<TRouter, NodeHTTPRequest, NodeHTTPResponse>,
  'middleware'
>;

export const serveTRPC =
  <TRouter extends AnyTRPCRouter>(opts: Options<TRouter>): Middleware =>
  async (req, res, _next) => {
    // Zipadee uses 404 as a default status but some logic in
    // nodeHTTPRequestHandler assumes default status of 200.
    // https://github.com/trpc/trpc/blob/abc941152b71ff2d68c63156eb5a142174779261/packages/server/src/adapters/node-http/nodeHTTPRequestHandler.ts#L63
    res.statusCode = 200;

    const path = req.path[0] === '/' ? req.path.substring(1) : req.path;

    await nodeHTTPRequestHandler({
      ...opts,
      req: req.baseRequest,
      res: res.baseResponse,
      path,
    } as NodeHTTPRequestHandlerOptions<
      TRouter,
      NodeHTTPRequest,
      NodeHTTPResponse
    >);
  };
