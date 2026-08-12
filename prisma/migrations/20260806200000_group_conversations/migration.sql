-- Conversation group fields
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;

-- ConversationMember role field
ALTER TABLE "ConversationMember" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'MEMBER';

-- Index for creator lookups
CREATE INDEX IF NOT EXISTS "Conversation_createdBy_idx" ON "Conversation"("createdBy");
