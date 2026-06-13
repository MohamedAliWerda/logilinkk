import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import serverlessHttp from 'serverless-http';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';

const WEAK_JWT_SECRETS = new Set([
  'replace_with_a_strong_secret',
  'changeme',
  'secret',
  '',
]);

function assertStrongJwtSecret(): void {
  const secret = process.env.JWT_SECRET ?? '';
  if (WEAK_JWT_SECRETS.has(secret.trim())) {
    throw new Error(
      'JWT_SECRET is missing or set to a known weak placeholder. Set it in Netlify environment variables.',
    );
  }
  if (secret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters (256 bits of entropy).');
  }
}

let cachedHandler: any = null;

export async function createServerlessHandler(): Promise<any> {
  if (cachedHandler) return cachedHandler;

  assertStrongJwtSecret();

  const app = await NestFactory.create(AppModule, { logger: false });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.setGlobalPrefix('api');

  await app.init();

  const expressApp = app.getHttpAdapter().getInstance();
  cachedHandler = serverlessHttp(expressApp);
  return cachedHandler;
}
