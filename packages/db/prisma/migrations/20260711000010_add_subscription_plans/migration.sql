-- CreateTable
CREATE TABLE IF NOT EXISTS "subscription_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "price_monthly" INTEGER NOT NULL,
    "max_rooms" INTEGER NOT NULL,
    "max_users" INTEGER NOT NULL,
    "features" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_plans_slug_key" ON "subscription_plans"("slug");

-- AlterTable
ALTER TABLE "hotels"
    ADD COLUMN IF NOT EXISTS "subscription_plan_id" UUID,
    ADD COLUMN IF NOT EXISTS "room_limit_override" INTEGER,
    ADD COLUMN IF NOT EXISTS "feature_overrides" JSONB;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'hotels_subscription_plan_id_fkey'
  ) THEN
    ALTER TABLE "hotels" ADD CONSTRAINT "hotels_subscription_plan_id_fkey"
      FOREIGN KEY ("subscription_plan_id") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
