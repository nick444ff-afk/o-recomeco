-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "bot_id" TEXT NOT NULL,
    "token" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "interval" INTEGER NOT NULL DEFAULT 12,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "modes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_running" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" SERIAL NOT NULL,
    "bot_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "server" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stats" (
    "id" SERIAL NOT NULL,
    "bot_id" TEXT NOT NULL,
    "executions" INTEGER NOT NULL DEFAULT 0,
    "servers_processed" INTEGER NOT NULL DEFAULT 0,
    "messages_processed" INTEGER NOT NULL DEFAULT 0,
    "buttons_clicked" INTEGER NOT NULL DEFAULT 0,
    "messages_sent" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "last_execution" TIMESTAMP(3),

    CONSTRAINT "stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_bot_id_key" ON "settings"("bot_id");

-- CreateIndex
CREATE INDEX "logs_bot_id_created_at_idx" ON "logs"("bot_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stats_bot_id_key" ON "stats"("bot_id");
