import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';

/**
 * In-process wake-up for the live stream (GH#537). Whoever commits a notice for an account calls
 * `notify`; the open `GET /me/events` streams of that account wake up and look at the database now
 * instead of at their next 3 s check. It carries no data, only "something may have changed", so a
 * lost or spurious wake costs at most one extra query or the old poll delay. It only reaches streams
 * on the same API instance; notices written by the worker or another instance keep arriving by poll.
 */
@Injectable()
export class LiveSignal {
  private readonly emitter = new EventEmitter();

  constructor() {
    // One listener per open stream per account: the default cap of 10 would warn for no good reason.
    this.emitter.setMaxListeners(0);
  }

  /** Wakes every stream subscribed to one of `recipientIds`. */
  notify(recipientIds: Iterable<string>): void {
    for (const id of new Set(recipientIds)) this.emitter.emit(id);
  }

  /** Calls `listener` on each wake for `recipientId`; the returned function unsubscribes. */
  subscribe(recipientId: string, listener: () => void): () => void {
    this.emitter.on(recipientId, listener);
    return () => {
      this.emitter.off(recipientId, listener);
    };
  }
}
