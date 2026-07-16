-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "visit_type" TEXT NOT NULL,
    "extracted_fields" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "missing_fields" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "specificityScore" DOUBLE PRECISION,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);
