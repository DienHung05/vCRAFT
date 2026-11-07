import { Controller, Get, Header, HttpCode, Param, Post, Query, Req, Res } from '@nestjs/common';
import { type UploadMediaQuery, UploadMediaQuerySchema } from '@vcraft/contracts';
import { type Actor, CurrentActor, Public, Roles } from '../../common/auth/auth.guard';
import { AppError } from '../../common/errors/app-error';
import type { HttpReply, HttpRequest } from '../../common/http/http-types';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MediaService } from './application/media.service';

/** Phần `@fastify/multipart` gắn vào request mà controller dùng. */
interface MultipartRequest extends HttpRequest {
  isMultipart(): boolean;
  file(): Promise<{ mimetype: string; toBuffer(): Promise<Buffer> } | undefined>;
}

/** `@fastify/multipart` ném lỗi mang `code` này khi tệp vượt `limits.fileSize`. */
const isFileTooLarge = (error: unknown) =>
  (error as { code?: string } | null)?.code === 'FST_REQ_FILE_TOO_LARGE';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /**
   * Multipart, trường `file`. Trả 202: ảnh công khai còn chờ worker chuyển đổi. Người mua chỉ tải được tệp
   * đính kèm yêu cầu báo giá (FR-RFQ-01); `MediaService.upload` chặn các mục đích khác.
   */
  @Post()
  @HttpCode(202)
  @Roles('HOUSEHOLD', 'ADMIN', 'BUYER')
  async upload(
    @CurrentActor() actor: Actor,
    @Query(new ZodValidationPipe(UploadMediaQuerySchema)) query: UploadMediaQuery,
    @Req() request: MultipartRequest,
  ) {
    if (!request.isMultipart())
      throw new AppError('VALIDATION_MALFORMED_REQUEST', 'multipart required');
    let bytes: Buffer;
    let declaredMime: string;
    try {
      const part = await request.file();
      if (!part) throw new AppError('VALIDATION_MALFORMED_REQUEST', 'file part required');
      declaredMime = part.mimetype;
      bytes = await part.toBuffer();
    } catch (error) {
      if (isFileTooLarge(error)) throw new AppError('MEDIA_TOO_LARGE');
      throw error;
    }
    return this.media.upload(actor, query.purpose, { declaredMime, bytes: new Uint8Array(bytes) });
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  @Roles('HOUSEHOLD', 'ADMIN', 'BUYER')
  get(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.media.get(actor, id);
  }

  @Get(':id/read-url')
  @Header('Cache-Control', 'private, no-store')
  @Roles('HOUSEHOLD', 'ADMIN', 'BUYER')
  readUrl(@CurrentActor() actor: Actor, @Param('id', new UuidPipe()) id: string) {
    return this.media.readUrl(actor, id);
  }

  /** `STORAGE_DRIVER=local`: đích của URL ký; chữ ký là quyền đọc nên route không cần đăng nhập. */
  @Get('files/originals/:owner/:asset')
  @Public()
  async signedFile(
    @Param('owner', new UuidPipe()) owner: string,
    @Param('asset', new UuidPipe()) asset: string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Res() reply: HttpReply,
  ) {
    const file = await this.media.readSignedLocal(
      `originals/${owner}/${asset}`,
      String(expires ?? ''),
      String(signature ?? ''),
    );
    return reply
      .header('Content-Type', file.mime)
      .header('Cache-Control', 'private, no-store')
      .header('X-Content-Type-Options', 'nosniff')
      .send(Buffer.from(file.bytes));
  }
}
