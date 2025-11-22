-- CreateTable
CREATE TABLE "Asset" (
    "id" SERIAL NOT NULL,
    "providerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" SERIAL NOT NULL,
    "assetId" INTEGER NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerTs" TIMESTAMP(3),
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "volume24hUsd" DOUBLE PRECISION,
    "marketCapUsd" DOUBLE PRECISION,
    "change24hPct" DOUBLE PRECISION,

    CONSTRAINT "MarketSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectRun" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "assetsCount" INTEGER NOT NULL,
    "insertedCount" INTEGER NOT NULL,
    "errorMessage" TEXT,

    CONSTRAINT "CollectRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_providerId_key" ON "Asset"("providerId");

-- CreateIndex
CREATE INDEX "MarketSnapshot_assetId_ingestedAt_idx" ON "MarketSnapshot"("assetId", "ingestedAt" DESC);

-- AddForeignKey
ALTER TABLE "MarketSnapshot" ADD CONSTRAINT "MarketSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
