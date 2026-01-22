-- CreateEnum
CREATE TYPE "RegistrationIntent" AS ENUM ('OBRT', 'DRUSTVO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "registrationIntent" "RegistrationIntent";
ALTER TABLE "User" ADD COLUMN "intentChosenAt" TIMESTAMP(3);
