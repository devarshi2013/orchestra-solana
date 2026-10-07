-- CreateTable
CREATE TABLE "agent_conversations" (
    "id" UUID NOT NULL,
    "owner" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_conversations_owner_updated_at_idx" ON "agent_conversations"("owner", "updated_at");

