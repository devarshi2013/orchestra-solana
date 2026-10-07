-- CreateEnum
CREATE TYPE "CandleInterval" AS ENUM ('H1', 'D1');

-- CreateTable
CREATE TABLE "tracked_mints" (
    "mint" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,

    CONSTRAINT "tracked_mints_pkey" PRIMARY KEY ("mint")
);

-- CreateTable
CREATE TABLE "candles" (
    "mint" TEXT NOT NULL,
    "interval" "CandleInterval" NOT NULL,
    "open_time" TIMESTAMPTZ(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "volume_usd" DOUBLE PRECISION,

    CONSTRAINT "candles_pkey" PRIMARY KEY ("mint","interval","open_time")
);

