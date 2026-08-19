CREATE TYPE "OximyProduct" AS ENUM ('visibility', 'relay', 'sidekick');

ALTER TABLE "deal"
ADD COLUMN "products" "OximyProduct"[] NOT NULL DEFAULT ARRAY[]::"OximyProduct"[];

CREATE INDEX "deal_products_idx" ON "deal" USING GIN ("products");
