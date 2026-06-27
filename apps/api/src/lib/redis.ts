import IORedis from "ioredis";
import { env } from "./env";

function parseRedisUrl(url: string): {
  host:                 string;
  port:                 number;
  password?:            string;
  db?:                  number;
  maxRetriesPerRequest: null;
  enableReadyCheck:     boolean;
} {
  const parsed = new URL(url);
  return {
    host:                 parsed.hostname || "localhost",
    port:                 parseInt(parsed.port || "6379", 10),
    password:             parsed.password || undefined,
    db:                   parsed.pathname ? parseInt(parsed.pathname.slice(1) || "0", 10) : 0,
    maxRetriesPerRequest: null,  // required by BullMQ
    enableReadyCheck:     false,
  };
}

// Plain options object passed to BullMQ — avoids ioredis version conflicts
// because BullMQ uses its own bundled ioredis internally.
export const redisConnectionOptions = parseRedisUrl(env.REDIS_URL);

// IORedis instance for any direct (non-BullMQ) Redis operations.
export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck:     false,
});

redis.on("error",   (err) => console.error("Redis connection error:", err));
redis.on("connect", ()    => console.log("✅ Redis connected"));
