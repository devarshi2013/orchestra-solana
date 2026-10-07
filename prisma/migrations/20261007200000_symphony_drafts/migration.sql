-- CreateTable
CREATE TABLE "symphony_drafts" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "symphony" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "symphony_drafts_pkey" PRIMARY KEY ("id")
);

