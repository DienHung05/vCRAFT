/**
 * Phần tối thiểu của request/reply Fastify mà tầng chung dùng; tránh phụ thuộc trực tiếp gói `fastify`
 * (chỉ đến gián tiếp qua `@nestjs/platform-fastify`).
 */
export interface HttpRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
}

export interface HttpReply {
  status(code: number): HttpReply;
  header(name: string, value: string): HttpReply;
  send(payload: unknown): unknown;
}
