import { createServer, type Server, Socket } from 'node:net';

/**
 * TCP proxy between the app and the test database that can go silent on demand: after `blackhole()` every open
 * connection, and every new one, stops carrying bytes without being closed. That is what a pooler or network path
 * that drops a link without FIN/RST looks like to `pg`; the client just waits. `revive()` lets new connections
 * through again, while the ones that went silent stay dead.
 */
export class DbProxy {
  private readonly sockets = new Set<Socket>();
  private readonly silent = new WeakSet<Socket>();
  private blackholed = false;

  private constructor(
    private readonly server: Server,
    readonly port: number,
  ) {}

  static async start(target: { host: string; port: number }): Promise<DbProxy> {
    let proxy: DbProxy | undefined;
    const server = createServer((client) => {
      // `proxy` is set before the first connection can arrive
      const self = proxy as DbProxy;
      self.track(client);
      if (self.blackholed) {
        self.silent.add(client);
        return;
      }
      const upstream = new Socket();
      self.track(upstream);
      upstream.connect(target.port, target.host);
      client.on('data', (chunk) => {
        if (!self.silent.has(client)) upstream.write(chunk);
      });
      upstream.on('data', (chunk) => {
        if (!self.silent.has(client)) client.write(chunk);
      });
      const close = () => {
        client.destroy();
        upstream.destroy();
      };
      client.on('close', close);
      upstream.on('close', close);
      client.on('error', close);
      upstream.on('error', close);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('proxy did not bind');
    proxy = new DbProxy(server, address.port);
    return proxy;
  }

  private track(socket: Socket): void {
    this.sockets.add(socket);
    socket.on('close', () => this.sockets.delete(socket));
    socket.on('error', () => undefined);
  }

  /** Every connection, existing and future, silently stops carrying data. */
  blackhole(): void {
    this.blackholed = true;
    for (const socket of this.sockets) this.silent.add(socket);
  }

  /** New connections work again; connections that already went silent stay dead. */
  revive(): void {
    this.blackholed = false;
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
