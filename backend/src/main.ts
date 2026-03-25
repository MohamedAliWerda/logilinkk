import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
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

  const preferredPort = process.env.PORT ? Number(process.env.PORT) : 3000;
  const maxPortFallbackAttempts = 10;

  for (let attempt = 0; attempt <= maxPortFallbackAttempts; attempt += 1) {
    const port = preferredPort + attempt;

    try {
      await app.listen(port);
      logger.log(`API listening on port ${port}`);
      return;
    } catch (error) {
      const isPortInUse =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'EADDRINUSE';

      if (!isPortInUse || attempt === maxPortFallbackAttempts) {
        throw error;
      }

      logger.warn(`Port ${port} is already in use. Retrying on ${port + 1}...`);
    }
  }
}

void bootstrap();
