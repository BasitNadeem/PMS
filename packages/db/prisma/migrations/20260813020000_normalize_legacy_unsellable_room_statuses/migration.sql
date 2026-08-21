-- Reserved migration boundary for the room-inventory normalization rollout.
-- Legacy UNDER_MAINTENANCE rows were normalized in 20260813010000 and the
-- remaining OUT_OF_ORDER/BLOCKED values are still valid RoomStatus enum values.
-- Keep this migration as an explicit no-op so every clone and deployment has a
-- complete, ordered Prisma migration history without rewriting live room data.
SELECT 1;
