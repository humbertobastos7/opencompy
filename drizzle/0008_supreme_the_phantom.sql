CREATE INDEX "users_organization_id_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "senior_likes_senior_id_idx" ON "resident_likes" USING btree ("senior_id");--> statement-breakpoint
ALTER TABLE "resident_likes" ADD CONSTRAINT "resident_likes_senior_id_unique" UNIQUE("senior_id");