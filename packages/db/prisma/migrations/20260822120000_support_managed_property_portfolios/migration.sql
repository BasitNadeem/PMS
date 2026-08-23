-- Support-managed multi-property portfolios.
--
-- These tables link otherwise independent hotel accounts. They do not merge
-- tenant data or user credentials: every access row names one user, that
-- user's home hotel, and the exact portfolio scope granted by support.

CREATE TYPE "PortfolioAccessRole" AS ENUM ('OWNER', 'MANAGER');
CREATE TYPE "PortfolioSwitchPolicy" AS ENUM ('OWNERS_ONLY', 'OWNERS_AND_MANAGERS', 'SELECTED_ACCOUNTS');

CREATE TABLE "property_portfolios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "switch_policy" "PortfolioSwitchPolicy" NOT NULL DEFAULT 'OWNERS_ONLY',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_admin_email" TEXT NOT NULL,
    "updated_by_admin_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "property_portfolios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "property_portfolio_hotels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "portfolio_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "property_portfolio_hotels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "property_portfolio_accesses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "portfolio_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "home_hotel_id" UUID NOT NULL,
    "access_role" "PortfolioAccessRole" NOT NULL,
    "can_view_portfolio" BOOLEAN NOT NULL DEFAULT true,
    "can_switch_properties" BOOLEAN NOT NULL DEFAULT true,
    "can_view_financials" BOOLEAN NOT NULL DEFAULT true,
    "all_properties" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_admin_email" TEXT NOT NULL,
    "updated_by_admin_email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "property_portfolio_accesses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "property_portfolio_access_hotels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "access_id" UUID NOT NULL,
    "hotel_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "property_portfolio_access_hotels_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "property_portfolios_is_active_idx" ON "property_portfolios"("is_active");
CREATE UNIQUE INDEX "property_portfolio_hotels_hotel_id_key" ON "property_portfolio_hotels"("hotel_id");
CREATE INDEX "property_portfolio_hotels_portfolio_id_idx" ON "property_portfolio_hotels"("portfolio_id");
CREATE UNIQUE INDEX "property_portfolio_hotels_portfolio_id_hotel_id_key" ON "property_portfolio_hotels"("portfolio_id", "hotel_id");
CREATE UNIQUE INDEX "property_portfolio_accesses_user_id_key" ON "property_portfolio_accesses"("user_id");
CREATE INDEX "property_portfolio_accesses_portfolio_id_is_active_idx" ON "property_portfolio_accesses"("portfolio_id", "is_active");
CREATE INDEX "property_portfolio_accesses_home_hotel_id_idx" ON "property_portfolio_accesses"("home_hotel_id");
CREATE UNIQUE INDEX "property_portfolio_accesses_portfolio_id_user_id_key" ON "property_portfolio_accesses"("portfolio_id", "user_id");
CREATE INDEX "property_portfolio_access_hotels_hotel_id_idx" ON "property_portfolio_access_hotels"("hotel_id");
CREATE UNIQUE INDEX "property_portfolio_access_hotels_access_id_hotel_id_key" ON "property_portfolio_access_hotels"("access_id", "hotel_id");

ALTER TABLE "property_portfolio_hotels"
  ADD CONSTRAINT "property_portfolio_hotels_portfolio_id_fkey"
  FOREIGN KEY ("portfolio_id") REFERENCES "property_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_portfolio_hotels"
  ADD CONSTRAINT "property_portfolio_hotels_hotel_id_fkey"
  FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_portfolio_accesses"
  ADD CONSTRAINT "property_portfolio_accesses_portfolio_id_fkey"
  FOREIGN KEY ("portfolio_id") REFERENCES "property_portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_portfolio_accesses"
  ADD CONSTRAINT "property_portfolio_accesses_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_portfolio_accesses"
  ADD CONSTRAINT "property_portfolio_accesses_home_hotel_id_fkey"
  FOREIGN KEY ("home_hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "property_portfolio_access_hotels"
  ADD CONSTRAINT "property_portfolio_access_hotels_access_id_fkey"
  FOREIGN KEY ("access_id") REFERENCES "property_portfolio_accesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "property_portfolio_access_hotels"
  ADD CONSTRAINT "property_portfolio_access_hotels_hotel_id_fkey"
  FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
