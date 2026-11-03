// Synthetic fixture: shared per-user limiter.
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const ratelimit = new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(20, '1 h') });

export async function checkRateLimit(key: string) {
  const { success } = await ratelimit.limit(key);
  return success;
}
