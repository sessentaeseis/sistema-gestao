/*
  Warnings:

  - You are about to drop the column `toke` on the `Sessao` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token]` on the table `Sessao` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `token` to the `Sessao` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Sessao_toke_key";

-- AlterTable
ALTER TABLE "Sessao" DROP COLUMN "toke",
ADD COLUMN     "token" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Usuario" ALTER COLUMN "cpf" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Sessao_token_key" ON "Sessao"("token");
