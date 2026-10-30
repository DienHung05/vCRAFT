import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureHttp } from './configure-http';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  await configureHttp(app);
  app.enableShutdownHooks();
  await app.listen({ port: Number(process.env.API_PORT ?? 4000), host: '0.0.0.0' });
}

void bootstrap();
