-- AlterTable
ALTER TABLE "symphony_drafts" ADD COLUMN     "owner" TEXT;

-- CreateIndex
CREATE INDEX "symphony_drafts_owner_updated_at_idx" ON "symphony_drafts"("owner", "updated_at");

