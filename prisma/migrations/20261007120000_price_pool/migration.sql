-- AlterTable
ALTER TABLE "tracked_mints" ADD COLUMN "price_pool" TEXT;

-- AlterTable
ALTER TABLE "candles" ALTER COLUMN "volume" DROP NOT NULL;
