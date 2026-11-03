import { createHmac, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { Body, Controller, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import {
  type AssistantFeedbackRequest,
  AssistantFeedbackRequestSchema,
  type AssistantMessageRequest,
  AssistantMessageRequestSchema,
} from '@vcraft/contracts';
import { Public } from '../../common/auth/auth.guard';
import type { HttpReply, HttpRequest } from '../../common/http/http-types';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AskAssistantService } from './application/ask-assistant.service';

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
    const stream = Readable.from(
      (async function* () {
        for await (const event of events) yield `data: ${JSON.stringify(event)}\n\n`;
      })(),
    );
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
