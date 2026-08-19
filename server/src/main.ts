import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { DatabaseService } from './modules/database/database.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const databaseService = app.get(DatabaseService);
  const port = Number(process.env.PORT ?? 3000);
  const dbName = await databaseService.ping();
  const origins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim());

  app.use(cookieParser());
  app.set('trust proxy', 1);
  app.enableCors({
    origin: origins,
    credentials: true,
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
  console.log(
    dbName ? `Database connected: ${dbName}` : 'Database disconnected',
  );
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
