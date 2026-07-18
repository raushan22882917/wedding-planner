import type { FastifyRequest } from 'fastify';
import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { supabase } from './supabase.js';
import type { AuthContext } from '../types.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

export async function authenticate(request: FastifyRequest): Promise<void> {
  if (!config.SUPABASE_AUTH_REQUIRED) {
    request.auth = { ownerId: config.DEMO_OWNER_ID };
    return;
  }
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new AppError('Missing bearer token', 401, 'unauthorized');
  const { data, error } = await supabase.auth.getUser(header.slice('Bearer '.length));
  if (error || !data.user) throw new AppError('Invalid bearer token', 401, 'unauthorized');
  request.auth = { ownerId: data.user.id };
}
