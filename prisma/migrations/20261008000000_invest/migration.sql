-- CreateEnum
CREATE TYPE "InvestmentStatus" AS ENUM ('active', 'paused', 'closed');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('planned', 'executing', 'completed', 'partial', 'cancelled');

-- CreateEnum
CREATE TYPE "LegStatus" AS ENUM ('pending', 'quoted', 'executing', 'succeeded', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "investments" (
    "id" UUID NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symphony" JSONB NOT NULL,
    "source_draft_id" UUID,
    "rebalance" JSONB NOT NULL,
    "drift_threshold_pct" DOUBLE PRECISION NOT NULL,
    "status" "InvestmentStatus" NOT NULL DEFAULT 'active',
    "notify_email" TEXT,
    "holdings" JSONB,
    "holdings_at" TIMESTAMP(3),
    "next_due_at" TIMESTAMP(3),
    "last_rebalanced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rebalance_runs" (
    "id" UUID NOT NULL,
    "investment_id" UUID NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'planned',
    "plan" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "rebalance_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rebalance_legs" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "input_mint" TEXT NOT NULL,
    "output_mint" TEXT NOT NULL,
    "planned_usd" DOUBLE PRECISION NOT NULL,
    "planned_amount" TEXT NOT NULL,
    "full" BOOLEAN NOT NULL DEFAULT false,
    "status" "LegStatus" NOT NULL DEFAULT 'pending',
    "amount" TEXT,
    "request_id" TEXT,
    "order_transaction" TEXT,
    "quote" JSONB,
    "signature" TEXT,
    "input_amount" TEXT,
    "output_amount" TEXT,
    "realized_price" DOUBLE PRECISION,
    "error" TEXT,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rebalance_legs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "owner" TEXT NOT NULL,
    "investment_id" UUID,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    "emailed_at" TIMESTAMP(3),
    "pushed_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "endpoint" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("endpoint")
);

-- CreateIndex
CREATE INDEX "investments_owner_idx" ON "investments"("owner");

-- CreateIndex
CREATE INDEX "investments_status_next_due_at_idx" ON "investments"("status", "next_due_at");

-- CreateIndex
CREATE INDEX "rebalance_runs_investment_id_created_at_idx" ON "rebalance_runs"("investment_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "rebalance_legs_run_id_index_key" ON "rebalance_legs"("run_id", "index");

-- CreateIndex
CREATE INDEX "notifications_owner_read_at_idx" ON "notifications"("owner", "read_at");

-- CreateIndex
CREATE INDEX "push_subscriptions_owner_idx" ON "push_subscriptions"("owner");

-- AddForeignKey
ALTER TABLE "rebalance_runs" ADD CONSTRAINT "rebalance_runs_investment_id_fkey" FOREIGN KEY ("investment_id") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebalance_legs" ADD CONSTRAINT "rebalance_legs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "rebalance_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_investment_id_fkey" FOREIGN KEY ("investment_id") REFERENCES "investments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

