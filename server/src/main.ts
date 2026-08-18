import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { DatabaseService } from './modules/database/database.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const databaseService = app.get(DatabaseService);
  const port = configService.get<number>('PORT', 3000);
  const dbOk = await databaseService.ping();

  app.enableCors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);

  console.log(`Server running on port ${port}`);
  console.log(`Database ${dbOk ? 'connected' : 'disconnected'}`);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
