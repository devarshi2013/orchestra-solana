-- AlterTable
ALTER TABLE "agent_conversations" ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "assistant_disclosures" (
    "owner" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_disclosures_pkey" PRIMARY KEY ("owner")
);

-- CreateTable
CREATE TABLE "plan_executions" (
    "id" UUID NOT NULL,
    "owner" TEXT NOT NULL,
    "conversation_id" UUID,
    "ranking_method" TEXT NOT NULL,
    "total_usdc" DOUBLE PRECISION NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'planned',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "plan_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_execution_items" (
    "id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "index" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "usdc_amount" DOUBLE PRECISION NOT NULL,
    "status" "LegStatus" NOT NULL DEFAULT 'pending',
    "request_id" TEXT,
    "order_transaction" TEXT,
    "quote" JSONB,
    "signature" TEXT,
    "input_amount" TEXT,
    "output_amount" TEXT,
    "error" TEXT,
    "outcome_unknown" BOOLEAN NOT NULL DEFAULT false,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_execution_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plan_executions_owner_created_at_idx" ON "plan_executions"("owner", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "plan_execution_items_execution_id_index_key" ON "plan_execution_items"("execution_id", "index");

-- AddForeignKey
ALTER TABLE "plan_executions" ADD CONSTRAINT "plan_executions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "agent_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_execution_items" ADD CONSTRAINT "plan_execution_items_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "plan_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

