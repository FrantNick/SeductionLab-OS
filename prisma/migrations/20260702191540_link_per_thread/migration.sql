-- One tracking link per thread: TrackingLink gains a nullable threadId.
-- Existing links keep threadId = NULL (unused) until manually linked,
-- so no click, conversion, campaign or link data is touched.

-- AlterTable
ALTER TABLE "TrackingLink" ADD COLUMN     "threadId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TrackingLink_threadId_key" ON "TrackingLink"("threadId");

-- AddForeignKey
ALTER TABLE "TrackingLink" ADD CONSTRAINT "TrackingLink_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
