import {STATUS_CODES} from 'node:http';

/**
 * An Error class for HTTP errors that includes a status code and a message.
 */
export class HttpError extends Error {
  /**
   * HTTP status code.
   */
  status: number;

  /**
   * Private message for logging, not sent to client unless in dev mode.
   */
  privateMessage?: string;

  constructor(status: number, message?: string, privateMessage?: string) {
    message ??= STATUS_CODES[status] ?? 'Unknown Error';
    super(message);
    this.status = status;
    this.privateMessage = privateMessage;
  }
}
