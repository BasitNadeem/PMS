-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING', 'KITCHEN', 'MAINTENANCE', 'ACCOUNTANT');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('VACANT_CLEAN', 'VACANT_DIRTY', 'OCCUPIED', 'OUT_OF_ORDER', 'UNDER_MAINTENANCE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RoomTypeName" AS ENUM ('SINGLE', 'DOUBLE', 'TWIN', 'TRIPLE', 'FAMILY', 'SUITE', 'DORMITORY', 'COTTAGE', 'TENT_GLAMPING');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ENQUIRY', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'NO_SHOW', 'CANCELLED', 'WAITLISTED');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WALK_IN', 'PHONE', 'WHATSAPP', 'DIRECT_WEBSITE', 'BOOKING_COM', 'AGODA', 'EXPEDIA', 'AIRBNB', 'BOOKME_PK', 'SASTATICKET_PK', 'TRAVEL_AGENT', 'OTA_OTHER');

-- CreateEnum
CREATE TYPE "GuestType" AS ENUM ('INDIVIDUAL', 'GROUP', 'CORPORATE', 'TOUR_OPERATOR');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'CHEQUE', 'ADVANCE_DEPOSIT', 'OTA_COLLECT', 'COMPLIMENTARY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "FolioItemType" AS ENUM ('ROOM_CHARGE', 'FOOD_BEVERAGE', 'LAUNDRY', 'TRANSPORT', 'SPA', 'ACTIVITY', 'MINIBAR', 'TELEPHONE', 'INTERNET', 'TAX', 'DISCOUNT', 'ADJUSTMENT', 'DAMAGE_CHARGE', 'MISCELLANEOUS');

-- CreateEnum
CREATE TYPE "HousekeepingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'AWAITING_PARTS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'BOOKING_COM', 'AGODA', 'EXPEDIA', 'EMAIL', 'SMS', 'INTERNAL');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND', 'INTERNAL');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('RECEIVED', 'READ', 'REPLIED', 'PENDING_SEND', 'SENT', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('BOOKING_COM', 'AGODA', 'EXPEDIA', 'AIRBNB', 'BOOKME_PK', 'SASTATICKET_PK', 'CHANNEL_MANAGER');

-- CreateEnum
CREATE TYPE "RatePlanType" AS ENUM ('STANDARD', 'SEASONAL', 'PROMOTIONAL', 'CORPORATE', 'TRAVEL_AGENT', 'OTA_NET', 'COMPLEMENTARY');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('PURCHASE', 'CONSUMPTION', 'WASTE', 'ADJUSTMENT', 'TRANSFER', 'OPENING_STOCK');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CNIC', 'PASSPORT', 'DRIVING_LICENSE', 'NRIC', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOTEL', 'GUESTHOUSE', 'HOSTEL', 'RESORT', 'LODGE', 'CAMPSITE', 'SERVICED_APARTMENT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SUBMITTED_FBR', 'ACCEPTED_FBR', 'REJECTED_FBR', 'VOID');

-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('GST', 'PST_PRA', 'SST_SRB', 'KPST_KPRA', 'GBST_GBRA', 'WHT', 'ACCOMMODATION_TAX');

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" UUID,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "propertyType" "PropertyType" NOT NULL DEFAULT 'HOTEL',
    "phone" TEXT,
    "whatsapp_number" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "province" TEXT,
    "country" TEXT NOT NULL DEFAULT 'PK',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "google_place_id" TEXT,
    "ntn" TEXT,
    "strn" TEXT,
    "fbr_pos_id" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_trial_account" BOOLEAN NOT NULL DEFAULT true,
    "trial_ends_at" TIMESTAMP(3),
    "onboarded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "refresh_token_hash" TEXT,
    "password_reset_token" TEXT,
    "password_reset_expiry" TIMESTAMP(3),
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "role_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "invited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "typeName" "RoomTypeName" NOT NULL DEFAULT 'DOUBLE',
    "description" TEXT,
    "max_occupancy" INTEGER NOT NULL,
    "default_rate" INTEGER NOT NULL,
    "extra_bed_rate" INTEGER NOT NULL DEFAULT 0,
    "amenities" TEXT[],
    "photo_urls" TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER,
    "status" "RoomStatus" NOT NULL DEFAULT 'VACANT_CLEAN',
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_cleaned_at" TIMESTAMP(3),
    "last_checked_at" TIMESTAMP(3),
    "last_inspected_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "alternate_phone" TEXT,
    "nationality" TEXT,
    "is_foreigner" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT,
    "documentType" "DocumentType" NOT NULL DEFAULT 'CNIC',
    "document_number" TEXT,
    "document_expiry" TIMESTAMP(3),
    "document_scan_url" TEXT,
    "date_of_birth" TIMESTAMP(3),
    "gender" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "total_stays" INTEGER NOT NULL DEFAULT 0,
    "total_spend" INTEGER NOT NULL DEFAULT 0,
    "vip_level" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "internal_notes" TEXT,
    "is_blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklist_reason" TEXT,
    "source" "BookingSource",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "searchVector" tsvector,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_blacklist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "document_number" TEXT,
    "documentType" "DocumentType",
    "reason" TEXT NOT NULL,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "shared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "group_id" UUID,
    "confirmation_number" TEXT NOT NULL,
    "source" "BookingSource" NOT NULL DEFAULT 'WALK_IN',
    "ota_booking_ref" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "guestType" "GuestType" NOT NULL DEFAULT 'INDIVIDUAL',
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "actual_check_in" TIMESTAMP(3),
    "actual_check_out" TIMESTAMP(3),
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "infants" INTEGER NOT NULL DEFAULT 0,
    "quoted_rate" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL DEFAULT 0,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "advance_paid" INTEGER NOT NULL DEFAULT 0,
    "balance_due" INTEGER NOT NULL DEFAULT 0,
    "special_requests" TEXT,
    "internal_notes" TEXT,
    "dietary_requirements" TEXT,
    "purpose_of_visit" TEXT,
    "arrival_mode" TEXT,
    "estimated_arrival_time" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" UUID,
    "cancellation_fee" INTEGER NOT NULL DEFAULT 0,
    "is_walk_in" BOOLEAN NOT NULL DEFAULT false,
    "requires_pickup" BOOLEAN NOT NULL DEFAULT false,
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" UUID,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_rooms" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reservation_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "guest_id" UUID,
    "rate_per_night" INTEGER NOT NULL,
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "actual_check_in" TIMESTAMP(3),
    "actual_check_out" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservation_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_bookings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "group_ref" TEXT,
    "tour_operator_id" UUID,
    "billing_type" TEXT NOT NULL DEFAULT 'SPLIT',
    "payer_type" TEXT NOT NULL DEFAULT 'GUEST',
    "payer_name" TEXT,
    "payer_contact" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "guest_id" UUID NOT NULL,
    "is_leader" BOOLEAN NOT NULL DEFAULT false,
    "room_preference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "folio_number" TEXT NOT NULL,
    "charges_total" INTEGER NOT NULL DEFAULT 0,
    "discounts_total" INTEGER NOT NULL DEFAULT 0,
    "tax_total" INTEGER NOT NULL DEFAULT 0,
    "payments_total" INTEGER NOT NULL DEFAULT 0,
    "balance_due" INTEGER NOT NULL DEFAULT 0,
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "closed_at" TIMESTAMP(3),
    "closed_by" UUID,
    "invoice_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "folio_id" UUID NOT NULL,
    "type" "FolioItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_amount" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "net_amount" INTEGER NOT NULL,
    "pos_order_item_id" UUID,
    "room_id" UUID,
    "staff_id" UUID,
    "charge_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_voided" BOOLEAN NOT NULL DEFAULT false,
    "voided_at" TIMESTAMP(3),
    "voided_by" UUID,
    "void_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "folio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_splits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "folio_id" UUID NOT NULL,
    "payer_name" TEXT NOT NULL,
    "payer_type" TEXT NOT NULL,
    "payer_ref" TEXT,
    "amount" INTEGER NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folio_splits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "folio_id" UUID,
    "reservation_id" UUID,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "currency_code" TEXT NOT NULL DEFAULT 'PKR',
    "exchange_rate" DECIMAL(10,4),
    "transaction_ref" TEXT,
    "gateway_response" JSONB,
    "cash_denominations" JSONB,
    "receipt_number" TEXT,
    "is_refund" BOOLEAN NOT NULL DEFAULT false,
    "original_payment_id" UUID,
    "refund_reason" TEXT,
    "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "posted_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "name_urdu" TEXT,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "tax_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "inventory_item_id" UUID,
    "inventory_qty_used" DECIMAL(10,3),
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "is_kitchen_item" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "reservation_id" UUID,
    "folio_id" UUID,
    "table_number" TEXT,
    "room_number" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "is_posted_to_folio" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "served_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_order_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "pos_item_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "tax_rate" DECIMAL(5,4) NOT NULL,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "line_total" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "housekeeping_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "task_type" TEXT NOT NULL,
    "status" "HousekeepingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "scheduled_date" DATE NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "has_issue" BOOLEAN NOT NULL DEFAULT false,
    "issue_description" TEXT,
    "issue_photo_urls" TEXT[],
    "is_escalated" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "housekeeping_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "room_id" UUID,
    "reported_by_id" UUID,
    "assigned_to_id" UUID,
    "ticket_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "photo_urls" TEXT[],
    "resolution_notes" TEXT,
    "estimated_cost" INTEGER,
    "actual_cost" INTEGER,
    "parts_used" JSONB,
    "scheduled_for" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "current_stock" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "par_level" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "reorder_level" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "cost_per_unit" INTEGER NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_cost" INTEGER,
    "total_cost" INTEGER,
    "reference_id" TEXT,
    "reference_type" TEXT,
    "notes" TEXT,
    "performed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "guest_id" UUID,
    "reservation_id" UUID,
    "assigned_to_id" UUID,
    "subject" TEXT,
    "channel" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',
    "is_open" BOOLEAN NOT NULL DEFAULT true,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_snoozed" BOOLEAN NOT NULL DEFAULT false,
    "snoozed_until" TIMESTAMP(3),
    "last_message_at" TIMESTAMP(3),
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "internal_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "reservation_id" UUID,
    "channel" "MessageChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'RECEIVED',
    "body" TEXT NOT NULL,
    "media_urls" TEXT[],
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "template_name" TEXT,
    "external_message_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "sender_name" TEXT,
    "sender_phone" TEXT,
    "staff_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "RatePlanType" NOT NULL DEFAULT 'STANDARD',
    "description" TEXT,
    "valid_from" DATE,
    "valid_to" DATE,
    "days_of_week" INTEGER[],
    "min_los" INTEGER NOT NULL DEFAULT 1,
    "max_los" INTEGER,
    "min_advance" INTEGER,
    "max_advance" INTEGER,
    "min_occupancy" INTEGER,
    "modifier_type" TEXT NOT NULL DEFAULT 'FIXED',
    "modifier_value" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_plan_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rate_plan_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "rate" INTEGER NOT NULL,

    CONSTRAINT "rate_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "channelType" "ChannelType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "credentials" JSONB NOT NULL DEFAULT '{}',
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" TEXT,
    "last_sync_error" TEXT,
    "sync_inventory" BOOLEAN NOT NULL DEFAULT true,
    "sync_rates" BOOLEAN NOT NULL DEFAULT true,
    "commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "employee_id" TEXT,
    "department" TEXT,
    "designation" TEXT,
    "joining_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "staff_id" UUID NOT NULL,
    "shift_date" DATE NOT NULL,
    "shift_type" TEXT NOT NULL,
    "opening_balance" INTEGER NOT NULL DEFAULT 0,
    "cash_collected" INTEGER NOT NULL DEFAULT 0,
    "cash_expenses" INTEGER NOT NULL DEFAULT 0,
    "closing_balance" INTEGER NOT NULL DEFAULT 0,
    "expected_balance" INTEGER NOT NULL DEFAULT 0,
    "variance" INTEGER NOT NULL DEFAULT 0,
    "check_ins" INTEGER NOT NULL DEFAULT 0,
    "check_outs" INTEGER NOT NULL DEFAULT 0,
    "new_bookings" INTEGER NOT NULL DEFAULT 0,
    "pos_orders" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "signed_off_at" TIMESTAMP(3),
    "signed_off_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "taxType" "TaxType" NOT NULL,
    "rate" DECIMAL(5,4) NOT NULL,
    "is_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "applies_to" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "fbr_invoice_number" TEXT,
    "fbr_submitted_at" TIMESTAMP(3),
    "fbr_response" JSONB,
    "subtotal" INTEGER NOT NULL,
    "tax_amount" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "user_id" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "hotel_id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "options" TEXT[],
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "definition_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "roles_hotel_id_idx" ON "roles"("hotel_id");

-- CreateIndex
CREATE INDEX "roles_is_system_idx" ON "roles"("is_system");

-- CreateIndex
CREATE UNIQUE INDEX "roles_hotel_id_name_key" ON "roles"("hotel_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateIndex
CREATE INDEX "permissions_module_action_idx" ON "permissions"("module", "action");

-- CreateIndex
CREATE INDEX "role_permissions_role_id_idx" ON "role_permissions"("role_id");

-- CreateIndex
CREATE INDEX "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotels_slug_key" ON "hotels"("slug");

-- CreateIndex
CREATE INDEX "hotels_slug_idx" ON "hotels"("slug");

-- CreateIndex
CREATE INDEX "hotels_is_active_idx" ON "hotels"("is_active");

-- CreateIndex
CREATE INDEX "hotels_region_idx" ON "hotels"("region");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "hotel_users_hotel_id_idx" ON "hotel_users"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_users_user_id_idx" ON "hotel_users"("user_id");

-- CreateIndex
CREATE INDEX "hotel_users_hotel_id_role_idx" ON "hotel_users"("hotel_id", "role");

-- CreateIndex
CREATE INDEX "hotel_users_role_id_idx" ON "hotel_users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_users_hotel_id_user_id_key" ON "hotel_users"("hotel_id", "user_id");

-- CreateIndex
CREATE INDEX "room_types_hotel_id_idx" ON "room_types"("hotel_id");

-- CreateIndex
CREATE INDEX "room_types_hotel_id_is_active_idx" ON "room_types"("hotel_id", "is_active");

-- CreateIndex
CREATE INDEX "rooms_hotel_id_idx" ON "rooms"("hotel_id");

-- CreateIndex
CREATE INDEX "rooms_hotel_id_status_idx" ON "rooms"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "rooms_hotel_id_is_active_idx" ON "rooms"("hotel_id", "is_active");

-- CreateIndex
CREATE INDEX "rooms_room_type_id_idx" ON "rooms"("room_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_hotel_id_number_key" ON "rooms"("hotel_id", "number");

-- CreateIndex
CREATE INDEX "guests_hotel_id_idx" ON "guests"("hotel_id");

-- CreateIndex
CREATE INDEX "guests_hotel_id_document_number_idx" ON "guests"("hotel_id", "document_number");

-- CreateIndex
CREATE INDEX "guests_hotel_id_phone_idx" ON "guests"("hotel_id", "phone");

-- CreateIndex
CREATE INDEX "guests_hotel_id_is_blacklisted_idx" ON "guests"("hotel_id", "is_blacklisted");

-- CreateIndex
CREATE INDEX "guests_hotel_id_is_foreigner_idx" ON "guests"("hotel_id", "is_foreigner");

-- CreateIndex
CREATE INDEX "guests_hotel_id_deleted_at_idx" ON "guests"("hotel_id", "deleted_at");

-- CreateIndex
CREATE INDEX "guests_hotel_id_vip_level_idx" ON "guests"("hotel_id", "vip_level");

-- CreateIndex
CREATE INDEX "guest_blacklist_document_number_idx" ON "guest_blacklist"("document_number");

-- CreateIndex
CREATE INDEX "guest_blacklist_hotel_id_idx" ON "guest_blacklist"("hotel_id");

-- CreateIndex
CREATE INDEX "guest_blacklist_guest_id_idx" ON "guest_blacklist"("guest_id");

-- CreateIndex
CREATE INDEX "guest_blacklist_is_shared_document_number_idx" ON "guest_blacklist"("is_shared", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_confirmation_number_key" ON "reservations"("confirmation_number");

-- CreateIndex
CREATE INDEX "reservations_hotel_id_status_idx" ON "reservations"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "reservations_hotel_id_check_in_date_idx" ON "reservations"("hotel_id", "check_in_date");

-- CreateIndex
CREATE INDEX "reservations_hotel_id_check_out_date_idx" ON "reservations"("hotel_id", "check_out_date");

-- CreateIndex
CREATE INDEX "reservations_hotel_id_guest_id_idx" ON "reservations"("hotel_id", "guest_id");

-- CreateIndex
CREATE INDEX "reservations_hotel_id_source_idx" ON "reservations"("hotel_id", "source");

-- CreateIndex
CREATE INDEX "reservations_hotel_id_created_at_idx" ON "reservations"("hotel_id", "created_at");

-- CreateIndex
CREATE INDEX "reservations_hotel_id_ota_booking_ref_idx" ON "reservations"("hotel_id", "ota_booking_ref");

-- CreateIndex
CREATE INDEX "reservations_hotel_id_check_in_date_status_idx" ON "reservations"("hotel_id", "check_in_date", "status");

-- CreateIndex
CREATE INDEX "reservation_rooms_reservation_id_idx" ON "reservation_rooms"("reservation_id");

-- CreateIndex
CREATE INDEX "reservation_rooms_room_id_idx" ON "reservation_rooms"("room_id");

-- CreateIndex
CREATE INDEX "reservation_rooms_room_id_check_in_date_check_out_date_idx" ON "reservation_rooms"("room_id", "check_in_date", "check_out_date");

-- CreateIndex
CREATE INDEX "reservation_rooms_room_type_id_idx" ON "reservation_rooms"("room_type_id");

-- CreateIndex
CREATE INDEX "group_bookings_hotel_id_idx" ON "group_bookings"("hotel_id");

-- CreateIndex
CREATE INDEX "group_bookings_hotel_id_tour_operator_id_idx" ON "group_bookings"("hotel_id", "tour_operator_id");

-- CreateIndex
CREATE INDEX "group_members_group_id_idx" ON "group_members"("group_id");

-- CreateIndex
CREATE INDEX "group_members_guest_id_idx" ON "group_members"("guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_guest_id_key" ON "group_members"("group_id", "guest_id");

-- CreateIndex
CREATE UNIQUE INDEX "folios_reservation_id_key" ON "folios"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "folios_folio_number_key" ON "folios"("folio_number");

-- CreateIndex
CREATE INDEX "folios_hotel_id_idx" ON "folios"("hotel_id");

-- CreateIndex
CREATE INDEX "folios_hotel_id_is_open_idx" ON "folios"("hotel_id", "is_open");

-- CreateIndex
CREATE INDEX "folios_hotel_id_closed_at_idx" ON "folios"("hotel_id", "closed_at");

-- CreateIndex
CREATE INDEX "folio_items_folio_id_idx" ON "folio_items"("folio_id");

-- CreateIndex
CREATE INDEX "folio_items_hotel_id_charge_date_idx" ON "folio_items"("hotel_id", "charge_date");

-- CreateIndex
CREATE INDEX "folio_items_hotel_id_type_idx" ON "folio_items"("hotel_id", "type");

-- CreateIndex
CREATE INDEX "folio_items_pos_order_item_id_idx" ON "folio_items"("pos_order_item_id");

-- CreateIndex
CREATE INDEX "folio_splits_folio_id_idx" ON "folio_splits"("folio_id");

-- CreateIndex
CREATE INDEX "payments_hotel_id_posted_at_idx" ON "payments"("hotel_id", "posted_at");

-- CreateIndex
CREATE INDEX "payments_hotel_id_method_idx" ON "payments"("hotel_id", "method");

-- CreateIndex
CREATE INDEX "payments_hotel_id_status_idx" ON "payments"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "payments_folio_id_idx" ON "payments"("folio_id");

-- CreateIndex
CREATE INDEX "payments_reservation_id_idx" ON "payments"("reservation_id");

-- CreateIndex
CREATE INDEX "payments_original_payment_id_idx" ON "payments"("original_payment_id");

-- CreateIndex
CREATE INDEX "pos_categories_hotel_id_idx" ON "pos_categories"("hotel_id");

-- CreateIndex
CREATE INDEX "pos_categories_hotel_id_is_active_idx" ON "pos_categories"("hotel_id", "is_active");

-- CreateIndex
CREATE INDEX "pos_items_hotel_id_idx" ON "pos_items"("hotel_id");

-- CreateIndex
CREATE INDEX "pos_items_hotel_id_category_id_idx" ON "pos_items"("hotel_id", "category_id");

-- CreateIndex
CREATE INDEX "pos_items_hotel_id_is_available_idx" ON "pos_items"("hotel_id", "is_available");

-- CreateIndex
CREATE INDEX "pos_items_inventory_item_id_idx" ON "pos_items"("inventory_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_orders_order_number_key" ON "pos_orders"("order_number");

-- CreateIndex
CREATE INDEX "pos_orders_hotel_id_reservation_id_idx" ON "pos_orders"("hotel_id", "reservation_id");

-- CreateIndex
CREATE INDEX "pos_orders_hotel_id_created_at_idx" ON "pos_orders"("hotel_id", "created_at");

-- CreateIndex
CREATE INDEX "pos_orders_hotel_id_is_posted_to_folio_idx" ON "pos_orders"("hotel_id", "is_posted_to_folio");

-- CreateIndex
CREATE INDEX "pos_order_items_order_id_idx" ON "pos_order_items"("order_id");

-- CreateIndex
CREATE INDEX "pos_order_items_pos_item_id_idx" ON "pos_order_items"("pos_item_id");

-- CreateIndex
CREATE INDEX "housekeeping_tasks_hotel_id_scheduled_date_idx" ON "housekeeping_tasks"("hotel_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "housekeeping_tasks_hotel_id_status_idx" ON "housekeeping_tasks"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "housekeeping_tasks_room_id_idx" ON "housekeeping_tasks"("room_id");

-- CreateIndex
CREATE INDEX "housekeeping_tasks_assigned_to_id_scheduled_date_idx" ON "housekeeping_tasks"("assigned_to_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "housekeeping_tasks_hotel_id_is_escalated_idx" ON "housekeeping_tasks"("hotel_id", "is_escalated");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_tickets_ticket_number_key" ON "maintenance_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "maintenance_tickets_hotel_id_status_idx" ON "maintenance_tickets"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_tickets_hotel_id_priority_idx" ON "maintenance_tickets"("hotel_id", "priority");

-- CreateIndex
CREATE INDEX "maintenance_tickets_hotel_id_category_idx" ON "maintenance_tickets"("hotel_id", "category");

-- CreateIndex
CREATE INDEX "maintenance_tickets_room_id_idx" ON "maintenance_tickets"("room_id");

-- CreateIndex
CREATE INDEX "maintenance_tickets_assigned_to_id_idx" ON "maintenance_tickets"("assigned_to_id");

-- CreateIndex
CREATE INDEX "inventory_items_hotel_id_idx" ON "inventory_items"("hotel_id");

-- CreateIndex
CREATE INDEX "inventory_items_hotel_id_category_idx" ON "inventory_items"("hotel_id", "category");

-- CreateIndex
CREATE INDEX "inventory_items_hotel_id_is_active_idx" ON "inventory_items"("hotel_id", "is_active");

-- CreateIndex
CREATE INDEX "inventory_transactions_hotel_id_item_id_idx" ON "inventory_transactions"("hotel_id", "item_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_hotel_id_created_at_idx" ON "inventory_transactions"("hotel_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_transactions_item_id_created_at_idx" ON "inventory_transactions"("item_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_transactions_hotel_id_type_idx" ON "inventory_transactions"("hotel_id", "type");

-- CreateIndex
CREATE INDEX "conversations_hotel_id_is_open_idx" ON "conversations"("hotel_id", "is_open");

-- CreateIndex
CREATE INDEX "conversations_hotel_id_guest_id_idx" ON "conversations"("hotel_id", "guest_id");

-- CreateIndex
CREATE INDEX "conversations_hotel_id_last_message_at_idx" ON "conversations"("hotel_id", "last_message_at");

-- CreateIndex
CREATE INDEX "conversations_hotel_id_is_read_idx" ON "conversations"("hotel_id", "is_read");

-- CreateIndex
CREATE INDEX "conversations_assigned_to_id_idx" ON "conversations"("assigned_to_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_hotel_id_created_at_idx" ON "messages"("hotel_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_external_message_id_idx" ON "messages"("external_message_id");

-- CreateIndex
CREATE INDEX "messages_hotel_id_direction_status_idx" ON "messages"("hotel_id", "direction", "status");

-- CreateIndex
CREATE INDEX "rate_plans_hotel_id_idx" ON "rate_plans"("hotel_id");

-- CreateIndex
CREATE INDEX "rate_plans_hotel_id_is_active_idx" ON "rate_plans"("hotel_id", "is_active");

-- CreateIndex
CREATE INDEX "rate_plans_hotel_id_type_idx" ON "rate_plans"("hotel_id", "type");

-- CreateIndex
CREATE INDEX "rate_plans_hotel_id_valid_from_valid_to_idx" ON "rate_plans"("hotel_id", "valid_from", "valid_to");

-- CreateIndex
CREATE INDEX "rate_plan_items_rate_plan_id_idx" ON "rate_plan_items"("rate_plan_id");

-- CreateIndex
CREATE INDEX "rate_plan_items_room_type_id_idx" ON "rate_plan_items"("room_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_plan_items_rate_plan_id_room_type_id_key" ON "rate_plan_items"("rate_plan_id", "room_type_id");

-- CreateIndex
CREATE INDEX "channel_configs_hotel_id_idx" ON "channel_configs"("hotel_id");

-- CreateIndex
CREATE INDEX "channel_configs_hotel_id_is_active_idx" ON "channel_configs"("hotel_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "channel_configs_hotel_id_channelType_key" ON "channel_configs"("hotel_id", "channelType");

-- CreateIndex
CREATE INDEX "staff_hotel_id_idx" ON "staff"("hotel_id");

-- CreateIndex
CREATE INDEX "staff_hotel_id_department_idx" ON "staff"("hotel_id", "department");

-- CreateIndex
CREATE INDEX "staff_hotel_id_is_active_idx" ON "staff"("hotel_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "staff_hotel_id_user_id_key" ON "staff"("hotel_id", "user_id");

-- CreateIndex
CREATE INDEX "shift_reports_hotel_id_shift_date_idx" ON "shift_reports"("hotel_id", "shift_date");

-- CreateIndex
CREATE INDEX "shift_reports_hotel_id_shift_date_shift_type_idx" ON "shift_reports"("hotel_id", "shift_date", "shift_type");

-- CreateIndex
CREATE INDEX "shift_reports_staff_id_shift_date_idx" ON "shift_reports"("staff_id", "shift_date");

-- CreateIndex
CREATE INDEX "tax_configs_hotel_id_idx" ON "tax_configs"("hotel_id");

-- CreateIndex
CREATE INDEX "tax_configs_hotel_id_is_active_idx" ON "tax_configs"("hotel_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_hotel_id_idx" ON "invoices"("hotel_id");

-- CreateIndex
CREATE INDEX "invoices_hotel_id_status_idx" ON "invoices"("hotel_id", "status");

-- CreateIndex
CREATE INDEX "invoices_hotel_id_issued_at_idx" ON "invoices"("hotel_id", "issued_at");

-- CreateIndex
CREATE INDEX "audit_logs_hotel_id_created_at_idx" ON "audit_logs"("hotel_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_hotel_id_entity_entity_id_idx" ON "audit_logs"("hotel_id", "entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_hotel_id_action_idx" ON "audit_logs"("hotel_id", "action");

-- CreateIndex
CREATE INDEX "notifications_hotel_id_is_read_idx" ON "notifications"("hotel_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_hotel_id_created_at_idx" ON "notifications"("hotel_id", "created_at");

-- CreateIndex
CREATE INDEX "custom_field_definitions_hotel_id_entity_idx" ON "custom_field_definitions"("hotel_id", "entity");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_hotel_id_entity_key_key" ON "custom_field_definitions"("hotel_id", "entity", "key");

-- CreateIndex
CREATE INDEX "custom_field_values_definition_id_idx" ON "custom_field_values"("definition_id");

-- CreateIndex
CREATE INDEX "custom_field_values_entity_id_idx" ON "custom_field_values"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_definition_id_entity_id_key" ON "custom_field_values"("definition_id", "entity_id");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_users" ADD CONSTRAINT "hotel_users_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_users" ADD CONSTRAINT "hotel_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_users" ADD CONSTRAINT "hotel_users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_types" ADD CONSTRAINT "room_types_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_blacklist" ADD CONSTRAINT "guest_blacklist_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_rooms" ADD CONSTRAINT "reservation_rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "group_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folios" ADD CONSTRAINT "folios_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folios" ADD CONSTRAINT "folios_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folios" ADD CONSTRAINT "folios_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_items" ADD CONSTRAINT "folio_items_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_items" ADD CONSTRAINT "folio_items_pos_order_item_id_fkey" FOREIGN KEY ("pos_order_item_id") REFERENCES "pos_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_splits" ADD CONSTRAINT "folio_splits_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_categories" ADD CONSTRAINT "pos_categories_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_items" ADD CONSTRAINT "pos_items_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_items" ADD CONSTRAINT "pos_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "pos_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_items" ADD CONSTRAINT "pos_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_items" ADD CONSTRAINT "pos_order_items_pos_item_id_fkey" FOREIGN KEY ("pos_item_id") REFERENCES "pos_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plan_items" ADD CONSTRAINT "rate_plan_items_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plan_items" ADD CONSTRAINT "rate_plan_items_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_configs" ADD CONSTRAINT "channel_configs_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_reports" ADD CONSTRAINT "shift_reports_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_configs" ADD CONSTRAINT "tax_configs_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

