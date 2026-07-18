import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { ZodError } from 'zod';
import { config } from './config.js';
import { AppError } from './lib/errors.js';
import { v1Routes } from './routes/v1.js';
import { ScrapeWorker } from './services/worker.js';

const app = Fastify({ logger: { level: config.LOG_LEVEL } });
await app.register(helmet);
await app.register(cors, { origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : false, credentials: true });
await app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });
await app.register(swagger, {
  openapi: { info: { title: 'Scrape & Fetch API', version: '1.0.0' }, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } } },
});
await app.register(swaggerUi, { routePrefix: '/docs' });

app.get('/health', async () => ({ status: 'ok' }));
await app.register(v1Routes, { prefix: '/v1' });

app.setErrorHandler((error, request, reply) => {
  const statusCode = error instanceof AppError ? error.statusCode : error instanceof ZodError ? 400 : 500;
  const code = error instanceof AppError ? error.code : error instanceof ZodError ? 'validation_error' : 'internal_error';
  if (statusCode >= 500) request.log.error({ err: error }, 'request failed');
  const message = error instanceof ZodError ? error.issues.map((item) => item.message).join('; ') : error instanceof Error ? error.message : 'Unexpected error';
  return reply.code(statusCode).send({ error: { code, message } });
});

const worker = new ScrapeWorker(app.log);
if (config.RUN_WORKER) worker.start();
app.addHook('onClose', () => worker.stop());

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
