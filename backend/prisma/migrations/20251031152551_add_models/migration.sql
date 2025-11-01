-- CreateTable
CREATE TABLE "Asset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "providerId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MarketSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "assetId" INTEGER NOT NULL,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerTs" DATETIME,
    "priceUsd" REAL NOT NULL,
    "volume24hUsd" REAL,
    "marketCapUsd" REAL,
    "change24hPct" REAL,
    CONSTRAINT "MarketSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectRun" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    "status" TEXT NOT NULL,
    "assetsCount" INTEGER NOT NULL,
    "insertedCount" INTEGER NOT NULL,
    "errorMessage" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_providerId_key" ON "Asset"("providerId");

-- CreateIndex
CREATE INDEX "MarketSnapshot_assetId_ingestedAt_idx" ON "MarketSnapshot"("assetId", "ingestedAt" DESC);
