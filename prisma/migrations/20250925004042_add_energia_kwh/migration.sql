/*
  Warnings:

  - You are about to drop the column `consumption` on the `Measurement` table. All the data in the column will be lost.
  - You are about to drop the column `current` on the `Measurement` table. All the data in the column will be lost.
  - You are about to drop the column `power` on the `Measurement` table. All the data in the column will be lost.
  - You are about to drop the column `temperature` on the `Measurement` table. All the data in the column will be lost.
  - You are about to drop the column `voltage` on the `Measurement` table. All the data in the column will be lost.
  - Added the required column `energia_kWh` to the `Measurement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Measurement" DROP COLUMN "consumption",
DROP COLUMN "current",
DROP COLUMN "power",
DROP COLUMN "temperature",
DROP COLUMN "voltage",
ADD COLUMN     "energia_kWh" DOUBLE PRECISION NOT NULL;
