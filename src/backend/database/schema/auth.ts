import { type InferSelectModel } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { z } from "zod";

export const UserRoleSchema = z.enum(["admin", "caregiver", "senior"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const InstitutionTypeSchema = z.enum(["ipss", "family"]);
export type InstitutionType = z.infer<typeof InstitutionTypeSchema>;

export const plans = pgTable("plans", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name", { length: 100 }).notNull().unique(),
	maxSeniors: integer("max_seniors"),
	maxTalkingMinutesPerMonth: integer("max_talking_minutes_per_month"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const institutions = pgTable("institutions", {
	id: uuid("id").primaryKey().defaultRandom(),
	type: text("type").$type<InstitutionType>().notNull().default("ipss"),
	designation: varchar("designation", { length: 255 }),
	location: text("location"),
	planId: uuid("plan_id").references(() => plans.id, { onDelete: "set null" }),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable(
	"users",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		organizationId: uuid("organization_id").references(() => institutions.id),
		email: varchar("email", { length: 255 }).notNull().unique(),
		username: varchar("username", { length: 100 }).notNull(),
		// Only set for caregiver/admin records; the local user has no password.
		passwordHash: text("password_hash"),
		role: text("role").$type<UserRole>().notNull(),
		isActive: boolean("is_active").default(true).notNull(),
		termsAcceptedAt: timestamp("terms_accepted_at"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => ({
		organizationIdIdx: index("users_organization_id_idx").on(
			table.organizationId,
		),
	}),
);

export type User = InferSelectModel<typeof users>;
