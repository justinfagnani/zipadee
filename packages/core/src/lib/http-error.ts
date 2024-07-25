import {STATUS_CODES} from 'node:http';

export class HttpError extends Error {
  status: number;

  constructor(status: number, message?: string) {
    message ??= STATUS_CODES[status] ?? 'Unknown Error';
    super(message);
    this.status = status;
  }
}
