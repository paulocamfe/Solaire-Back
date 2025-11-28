/*
  Warnings:

  - You are about to drop the column `createdAt` on the `Measurement` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Measurement` table. All the data in the column will be lost.
  - You are about to drop the column `branchId` on the `Panel` table. All the data in the column will be lost.
  - You are about to drop the column `companyId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Branch` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Company` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Branch" DROP CONSTRAINT "Branch_companyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Panel" DROP CONSTRAINT "Panel_branchId_fkey";

-- DropForeignKey
ALTER TABLE "public"."User" DROP CONSTRAINT "User_companyId_fkey";

-- AlterTable
ALTER TABLE "public"."Measurement" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "co2_kg" DOUBLE PRECISION,
ADD COLUMN     "economia_Reais" DOUBLE PRECISION,
ALTER COLUMN "status" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Panel" DROP COLUMN "branchId";

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "companyId",
ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpires" TIMESTAMP(3);

-- DropTable
DROP TABLE "public"."Branch";

-- DropTable
DROP TABLE "public"."Company";

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "stripeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeId_key" ON "public"."Payment"("stripeId");

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
