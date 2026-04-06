import { ValidationPipe } from '@nestjs/common';
import { setServers } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';

async function bootstrap() {
  // Use system DNS by default. Public DNS forcing can break connectivity on restricted networks.
  if (String(process.env.FORCE_PUBLIC_DNS ?? '').toLowerCase() === 'true') {
    try {
      setServers(['8.8.8.8', '8.8.4.4']);
      // eslint-disable-next-line no-console
      console.log('[bootstrap] FORCE_PUBLIC_DNS=true, using Google DNS resolvers.');
    } catch {
      // ignore if not supported in this Node environment
    }
  }
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

void bootstrap();
