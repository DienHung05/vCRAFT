import { createHmac, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Logger,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  type AssistantEvent,
  type AssistantFeedbackRequest,
  AssistantFeedbackRequestSchema,
  type AssistantMessageRequest,
  AssistantMessageRequestSchema,
  type AssistantStatsQuery,
  AssistantStatsQuerySchema,
} from '@vcraft/contracts';
import { Public, Roles } from '../../common/auth/auth.guard';
import type { HttpReply, HttpRequest } from '../../common/http/http-types';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AskAssistantService } from './application/ask-assistant.service';
import { AssistantStatsService } from './application/assistant-stats.service';

/**
 * Turns assistant events into SSE `data:` lines. A turn that throws is logged with its stack and ends
 * with an `INTERNAL` error event instead of a silently cut stream (GH#147); a client that went away is
 * not an error.
 */
export async function* sseLines(
  events: AsyncIterable<AssistantEvent>,
  signal: AbortSignal,
  logger: Pick<Logger, 'error'>,
): AsyncGenerator<string> {
  try {
    for await (const event of events) yield `data: ${JSON.stringify(event)}\n\n`;
  } catch (error) {
    if (signal.aborted) return;
    logger.error(
      `assistant turn failed: ${String(error)}`,
      error instanceof Error ? error.stack : undefined,
    );
    yield `data: ${JSON.stringify({ type: 'error', code: 'INTERNAL' } satisfies AssistantEvent)}\n\n`;
  }
}

/** The parts of a Fastify request the stream needs: the client IP and the socket's close event. */
interface StreamRequest extends HttpRequest {
  readonly ip: string;
  readonly raw: { once(event: 'close', listener: () => void): unknown };
}

// Without a configured salt the hash still hides the IP, it just changes on every restart.
const IP_SALT = process.env.ASSISTANT_IP_SALT?.trim() || randomBytes(32).toString('hex');

/** A salted hash of the visitor's IP: the only trace of them in rate limits and logs (FR-AST-08). */
export const hashIp = (ip: string) => createHmac('sha256', IP_SALT).update(ip).digest('hex');

/**
 * The Fox assistant (PLAN E15). Open to guests: the answer streams as Server-Sent Events, one
 * `AssistantEvent` per `data:` line, and the logic lives in `AskAssistantService`.
 */
@Controller('assistant')
@Public()
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);

  constructor(private readonly assistant: AskAssistantService) {}

  @Post('messages')
  ask(
    @Body(new ZodValidationPipe(AssistantMessageRequestSchema)) body: AssistantMessageRequest,
    @Req() request: StreamRequest,
    @Res() reply: HttpReply,
  ) {
    const aborted = new AbortController();
    request.raw.once('close', () => aborted.abort());
    const events = this.assistant.ask(body, hashIp(request.ip), aborted.signal);
    const stream = Readable.from(sseLines(events, aborted.signal, this.logger));
    // 200, not the 201 Nest gives a POST: nothing is created, an answer is streamed.
    return reply
      .status(200)
      .header('Content-Type', 'text/event-stream; charset=utf-8')
      .header('Cache-Control', 'no-cache, no-transform')
      .header('X-Accel-Buffering', 'no')
      .send(stream);
  }

  @Post('messages/:id/feedback')
  @HttpCode(204)
  async feedback(
    @Param('id', new UuidPipe()) id: string,
    @Body(new ZodValidationPipe(AssistantFeedbackRequestSchema)) body: AssistantFeedbackRequest,
  ): Promise<void> {
    await this.assistant.feedback(id, body);
  }
}

/** The admin dashboard's Assistant card (FR-AST-08, GH#82). */
@Controller('admin/assistant')
@Roles('ADMIN')
export class AssistantStatsController {
  constructor(private readonly stats: AssistantStatsService) {}

  @Get('stats')
  @Header('Cache-Control', 'private, no-store')
  get(@Query(new ZodValidationPipe(AssistantStatsQuerySchema)) query: AssistantStatsQuery) {
    return this.stats.stats(query.days);
  }
}
