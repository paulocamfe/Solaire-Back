/*
  Warnings:

  - A unique constraint covering the columns `[serial,userId]` on the table `Panel` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Panel_serial_key";

-- CreateIndex
CREATE UNIQUE INDEX "Panel_serial_userId_key" ON "Panel"("serial", "userId");
