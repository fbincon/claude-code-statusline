/** Test-only asynchronous loader hooks supported by Node 22.0.0 and newer. */
import type { MessagePort } from 'node:worker_threads';
import type { LoadHook } from 'node:module';
let port: MessagePort;
export function initialize(data: { port: MessagePort }): void {
  port = data.port;
  port.on('message', () => port.postMessage(null));
  port.unref();
}
export const load: LoadHook = async (url, context, next) => {
  const result = await next(url, context);
  port.postMessage(url);
  return result;
};
