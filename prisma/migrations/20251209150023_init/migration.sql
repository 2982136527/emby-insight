-- CreateTable
CREATE TABLE "Server" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 8096,
    "apiKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ServerUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "embyUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "globalUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ServerUser_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServerUser_globalUserId_fkey" FOREIGN KEY ("globalUserId") REFERENCES "GlobalUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GlobalUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlayHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "serverUserId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "seriesName" TEXT,
    "seasonName" TEXT,
    "episodeNumber" INTEGER,
    "genres" TEXT NOT NULL,
    "year" INTEGER,
    "duration" INTEGER NOT NULL,
    "playedAt" DATETIME NOT NULL,
    "playDuration" INTEGER NOT NULL DEFAULT 0,
    "playCount" INTEGER NOT NULL DEFAULT 1,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "playbackPosition" INTEGER NOT NULL DEFAULT 0,
    "videoCodec" TEXT,
    "resolution" TEXT,
    "isHdr" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayHistory_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlayHistory_serverUserId_fkey" FOREIGN KEY ("serverUserId") REFERENCES "ServerUser" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serverId" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "lastSync" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SyncLog_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "Server" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ServerUser_serverId_embyUserId_key" ON "ServerUser"("serverId", "embyUserId");

-- CreateIndex
CREATE INDEX "PlayHistory_serverId_playedAt_idx" ON "PlayHistory"("serverId", "playedAt");

-- CreateIndex
CREATE INDEX "PlayHistory_serverUserId_playedAt_idx" ON "PlayHistory"("serverUserId", "playedAt");

-- CreateIndex
CREATE INDEX "PlayHistory_itemType_idx" ON "PlayHistory"("itemType");

-- CreateIndex
CREATE UNIQUE INDEX "PlayHistory_serverId_serverUserId_itemId_playedAt_key" ON "PlayHistory"("serverId", "serverUserId", "itemId", "playedAt");
