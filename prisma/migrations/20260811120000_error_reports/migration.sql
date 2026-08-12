-- Global client-side error reporting (React Native ErrorBoundary -> dev triage)
CREATE TABLE IF NOT EXISTS "ErrorReport" (
    "id" TEXT NOT NULL DEFAULT cuid(),
    "userId" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "componentStack" TEXT,
    "platform" TEXT,
    "appVersion" TEXT,
    "deviceInfo" JSONB,
    "url" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ErrorReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ErrorReport_userId_idx" ON "ErrorReport"("userId");
CREATE INDEX IF NOT EXISTS "ErrorReport_platform_idx" ON "ErrorReport"("platform");

ALTER TABLE "ErrorReport" ADD CONSTRAINT "ErrorReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
