-- CreateEnum
CREATE TYPE "PresenceVisibility" AS ENUM ('PUBLIC', 'FRIENDS_ONLY', 'HIDDEN');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "presenceVisibility" "PresenceVisibility" NOT NULL DEFAULT 'FRIENDS_ONLY';