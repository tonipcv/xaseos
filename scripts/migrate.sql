-- Xase OS Database Migration
-- Idempotent: safe to run multiple times

CREATE TABLE IF NOT EXISTS "User" (
  "id"        TEXT PRIMARY KEY,
  "email"     TEXT UNIQUE NOT NULL,
  "name"      TEXT,
  "password"  TEXT NOT NULL,
  "role"      TEXT NOT NULL DEFAULT 'reviewer',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "UserApiKey" (
  "id"        TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "provider"  TEXT NOT NULL,
  "keyValue"  TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UserApiKey_userId_provider_key" UNIQUE ("userId", "provider")
);

CREATE TABLE IF NOT EXISTS "UserModelPref" (
  "id"      TEXT PRIMARY KEY,
  "userId"  TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "modelId" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "UserModelPref_userId_modelId_key" UNIQUE ("userId", "modelId")
);

CREATE TABLE IF NOT EXISTS "Task" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL REFERENCES "User"("id"),
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "systemPrompt" TEXT,
  "userPrompt"   TEXT NOT NULL,
  "modelIds"     TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Run" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL,
  "taskId"       TEXT NOT NULL REFERENCES "Task"("id"),
  "taskName"     TEXT NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'pending',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt"  TIMESTAMPTZ,
  "costEstimate" FLOAT
);

CREATE TABLE IF NOT EXISTS "ModelResponse" (
  "id"           TEXT PRIMARY KEY,
  "runId"        TEXT NOT NULL REFERENCES "Run"("id") ON DELETE CASCADE,
  "modelId"      TEXT NOT NULL,
  "modelName"    TEXT NOT NULL,
  "provider"     TEXT NOT NULL,
  "content"      TEXT,
  "latencyMs"    INTEGER NOT NULL,
  "tokensUsed"   INTEGER,
  "inputTokens"  INTEGER,
  "outputTokens" INTEGER,
  "cost"         FLOAT,
  "error"        TEXT
);

CREATE TABLE IF NOT EXISTS "ExpertReview" (
  "id"              TEXT PRIMARY KEY,
  "runId"           TEXT NOT NULL REFERENCES "Run"("id"),
  "modelResponseId" TEXT NOT NULL REFERENCES "ModelResponse"("id"),
  "reviewerId"      TEXT NOT NULL REFERENCES "User"("id"),
  "label"           TEXT NOT NULL,
  "score"           INTEGER NOT NULL,
  "rationale"       TEXT NOT NULL,
  "correctedOutput" TEXT,
  "status"          TEXT NOT NULL DEFAULT 'done',
  "reviewedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "Dataset" (
  "id"           TEXT PRIMARY KEY,
  "userId"       TEXT NOT NULL REFERENCES "User"("id"),
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "exportFormat" TEXT NOT NULL DEFAULT 'jsonl',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "DatasetRun" (
  "datasetId" TEXT NOT NULL REFERENCES "Dataset"("id") ON DELETE CASCADE,
  "runId"     TEXT NOT NULL REFERENCES "Run"("id"),
  PRIMARY KEY ("datasetId", "runId")
);

CREATE TABLE IF NOT EXISTS "ResponseCache" (
  "id"         TEXT PRIMARY KEY,
  "hash"       TEXT UNIQUE NOT NULL,
  "modelId"    TEXT NOT NULL,
  "provider"   TEXT NOT NULL,
  "response"   TEXT NOT NULL,
  "tokensUsed" INTEGER,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "TaskVersion" (
  "id"           TEXT PRIMARY KEY,
  "taskId"       TEXT NOT NULL REFERENCES "Task"("id") ON DELETE CASCADE,
  "version"      INTEGER NOT NULL,
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "systemPrompt" TEXT,
  "userPrompt"   TEXT NOT NULL,
  "modelIds"     TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add isAutomatic flag support to ExpertReview via status column (already exists)
-- status = 'automated' means LLM-as-a-Judge, status = 'done' means human review

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "Task_userId_idx" ON "Task"("userId");
CREATE INDEX IF NOT EXISTS "Run_userId_idx" ON "Run"("userId");
CREATE INDEX IF NOT EXISTS "Run_taskId_idx" ON "Run"("taskId");
CREATE INDEX IF NOT EXISTS "Run_status_idx" ON "Run"("status");
CREATE INDEX IF NOT EXISTS "ModelResponse_runId_idx" ON "ModelResponse"("runId");
CREATE INDEX IF NOT EXISTS "ExpertReview_runId_idx" ON "ExpertReview"("runId");
CREATE INDEX IF NOT EXISTS "ExpertReview_modelResponseId_idx" ON "ExpertReview"("modelResponseId");
CREATE INDEX IF NOT EXISTS "Dataset_userId_idx" ON "Dataset"("userId");
CREATE INDEX IF NOT EXISTS "TaskVersion_taskId_idx" ON "TaskVersion"("taskId");

-- Add unique constraint to prevent duplicate versions per task
CREATE UNIQUE INDEX IF NOT EXISTS "TaskVersion_taskId_version_key" ON "TaskVersion"("taskId", "version");

-- Add CHECK constraints for status columns to enforce valid values
ALTER TABLE "Run" DROP CONSTRAINT IF EXISTS "Run_status_check";
ALTER TABLE "Run" ADD CONSTRAINT "Run_status_check" CHECK (status IN ('pending', 'running', 'completed', 'failed'));

ALTER TABLE "ExpertReview" DROP CONSTRAINT IF EXISTS "ExpertReview_status_check";
ALTER TABLE "ExpertReview" ADD CONSTRAINT "ExpertReview_status_check" CHECK (status IN ('done', 'automated', 'imported'));
