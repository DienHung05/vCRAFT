import 'reflect-metadata';
import helmet from '@fastify/helmet';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureHttp } from './configure-http';

/** `CORS_ORIGINS`: danh sách origin được phép, ngăn cách bằng dấu phẩy (bỏ dấu `/` cuối). Rỗng = tắt CORS. */
function corsOrigins(raw = process.env.CORS_ORIGINS): string[] {
  return (raw ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

async function bootstrap() {
  // Sau reverse proxy (Render, Caddy) `req.ip` phải lấy từ X-Forwarded-For: bật bằng TRUST_PROXY=true.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: process.env.TRUST_PROXY === 'true' }),
  );
  await configureHttp(app);
  // Header bảo mật cho phản hồi JSON. Qua rewrite của Next, phản hồi API không nhận header của next.config nên đặt ở đây.
  await app.register(helmet, { crossOriginResourcePolicy: false });
  // Web gọi API cùng origin qua rewrite của Next/Caddy nên mặc định không cần CORS (ADR-16); chỉ bật khi gọi chéo origin.
  const origins = corsOrigins();
  if (origins.length > 0) {
    app.enableCors({
      origin: origins,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'If-Match', 'If-None-Match'],
      exposedHeaders: ['ETag'],
      maxAge: 600,
    });
  }
  app.enableShutdownHooks();
  // Render đặt PORT; API_PORT (nếu có) ưu tiên cho chạy cục bộ. Nghe 0.0.0.0 để nhận kết nối từ ngoài container.
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
  await app.listen({ port, host: '0.0.0.0' });
}

void bootstrap();
