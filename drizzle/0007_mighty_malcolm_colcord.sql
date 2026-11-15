CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires");--> statement-breakpoint
CREATE INDEX "caregiver_notes_senior_id_idx" ON "caregiver_notes" USING btree ("senior_id");--> statement-breakpoint
CREATE INDEX "conversations_senior_id_idx" ON "conversations" USING btree ("senior_id");--> statement-breakpoint
CREATE INDEX "conversations_created_at_idx" ON "conversations" USING btree ("created_At");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "session_logs_senior_id_idx" ON "session_logs" USING btree ("senior_id");