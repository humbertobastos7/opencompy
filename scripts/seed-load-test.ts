/**
 * Load test seed script.
 *
 * Populates the database with realistic data for stress testing.
 * Safe to re-run — skips rows that already exist.
 *
 * Usage:
 *   pnpm tsx scripts/seed-load-test.ts
 *   pnpm tsx scripts/seed-load-test.ts --institutions=5 --seniors=20 --conversations=50
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import * as argon2 from "argon2";
import * as schema from "../src/backend/database/schema/index";

// ── Config ────────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
	process.argv.slice(2).map((a) => {
		const [k, v] = a.replace("--", "").split("=");
		return [k, Number(v) || v];
	}),
);

const NUM_INSTITUTIONS = (args.institutions as number) ?? 3;
const NUM_CAREGIVERS_PER_INSTITUTION = (args.caregivers as number) ?? 5;
const NUM_SENIORS_PER_INSTITUTION = (args.seniors as number) ?? 10;
const NUM_CONVERSATIONS_PER_SENIOR = (args.conversations as number) ?? 20;
const NUM_MESSAGES_PER_CONVERSATION = (args.messages as number) ?? 8;
const NUM_FACTS_PER_SENIOR = (args.facts as number) ?? 15;

// ── DB setup ──────────────────────────────────────────────────────────────────

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

// ── Helpers ───────────────────────────────────────────────────────────────────

const rand = (min: number, max: number) =>
	Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T>(arr: T[]): T => arr[rand(0, arr.length - 1)];

const NAMES = [
	"Maria",
	"João",
	"Ana",
	"Carlos",
	"Beatriz",
	"António",
	"Sofia",
	"Rui",
	"Inês",
	"Pedro",
];
const SURNAMES = [
	"Silva",
	"Santos",
	"Ferreira",
	"Pereira",
	"Costa",
	"Rodrigues",
	"Martins",
	"Carvalho",
];
const TONES = ["positivo", "neutro", "negativo", "ansioso", "alegre", "triste"];
const TOPICS = [
	"família",
	"saúde",
	"memórias",
	"notícias",
	"tempo",
	"alimentação",
];
const SAMPLE_FACTS = [
	"Gosta de futebol, especialmente do Benfica",
	"Tem três filhos e cinco netos",
	"Nasceu em Lisboa em 1945",
	"Trabalhou como professor primário durante 30 anos",
	"Sofre de diabetes tipo 2",
	"Gosta de ouvir fado",
	"Não gosta de falar sobre política",
	"A sua comida favorita é bacalhau à brás",
	"Tem um cão chamado Bobi",
	"Praticou natação até aos 60 anos",
];

function randomEmbedding(dim = 1536): number[] {
	// Random unit vector — not a real embedding but structurally valid for pgvector
	const vec = Array.from({ length: dim }, () => Math.random() * 2 - 1);
	const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
	return vec.map((v) => v / norm);
}

function randomDate(daysBack: number): Date {
	return new Date(Date.now() - rand(0, daysBack) * 86_400_000);
}

// ── Seed ──────────────────────────────────────────────────────────────────────

async function main() {
	console.log("🌱 Starting seed...");
	console.log(
		`   ${NUM_INSTITUTIONS} institutions × ${NUM_SENIORS_PER_INSTITUTION} seniors × ${NUM_CONVERSATIONS_PER_SENIOR} conversations`,
	);

	const passwordHash = await argon2.hash("password123");
	const institutionIds: string[] = [];
	const seniorCredentials: { email: string; username: string }[] = [];

	// Institutions
	for (let i = 0; i < NUM_INSTITUTIONS; i++) {
		const [institution] = await db
			.insert(schema.institutions)
			.values({
				designation: `Lar ${pick(SURNAMES)} ${i + 1}`,
				location: pick(["Lisboa", "Porto", "Coimbra", "Braga", "Faro"]),
			})
			.returning({ id: schema.institutions.id });
		institutionIds.push(institution.id);
		process.stdout.write(`\r   Institution ${i + 1}/${NUM_INSTITUTIONS}`);
	}
	console.log();

	// Admin
	const adminEmail = "admin@loadtest.local";
	const existingAdmin = await db.query.users.findFirst({
		where: eq(schema.users.email, adminEmail),
	});
	if (!existingAdmin) {
		await db.insert(schema.users).values({
			email: adminEmail,
			username: "admin",
			passwordHash,
			role: "admin",
		});
	}

	// Caregivers
	for (let i = 0; i < NUM_INSTITUTIONS; i++) {
		for (let j = 0; j < NUM_CAREGIVERS_PER_INSTITUTION; j++) {
			const email = `caregiver_${i}_${j}@loadtest.local`;
			const existing = await db.query.users.findFirst({
				where: eq(schema.users.email, email),
			});
			if (existing) continue;

			const [user] = await db
				.insert(schema.users)
				.values({
					email,
					username: email.split("@")[0],
					passwordHash,
					role: "caregiver",
					organizationId: institutionIds[i],
				})
				.returning({ id: schema.users.id });

			await db.insert(schema.caregiver).values({
				userId: user.id,
				fullName: `${pick(NAMES)} ${pick(SURNAMES)}`,
			});
		}
		process.stdout.write(
			`\r   Caregivers: institution ${i + 1}/${NUM_INSTITUTIONS}`,
		);
	}
	console.log();

	// Seniors + conversations + facts
	for (let i = 0; i < NUM_INSTITUTIONS; i++) {
		for (let j = 0; j < NUM_SENIORS_PER_INSTITUTION; j++) {
			const email = `senior_${i}_${j}@loadtest.local`;
			const existing = await db.query.users.findFirst({
				where: eq(schema.users.email, email),
			});

			let userId: string;
			if (existing) {
				userId = existing.id;
			} else {
				const [user] = await db
					.insert(schema.users)
					.values({
						email,
						username: email.split("@")[0],
						passwordHash,
						role: "senior",
						organizationId: institutionIds[i],
					})
					.returning({ id: schema.users.id });

				userId = user.id;
				const fullName = `${pick(NAMES)} ${pick(SURNAMES)}`;
				await db.insert(schema.senior).values({
					userId,
					fullname: fullName,
					nickname: fullName.split(" ")[0],
					conversationsNumber: NUM_CONVERSATIONS_PER_SENIOR,
				});
				await db.insert(schema.seniorSettings).values({ seniorId: userId });
				seniorCredentials.push({ email, username: email.split("@")[0] });
			}

			// Conversations + messages
			for (let k = 0; k < NUM_CONVERSATIONS_PER_SENIOR; k++) {
				const createdAt = randomDate(90);
				const [conv] = await db
					.insert(schema.conversations)
					.values({
						seniorId: userId,
						createdAt,
						closedAt: new Date(createdAt.getTime() + rand(5, 30) * 60_000),
						summary: `Conversa sobre ${pick(TOPICS)} e ${pick(TOPICS)}.`,
						keyPoints: [pick(TOPICS), pick(TOPICS)],
						mainTopics: [pick(TOPICS)],
						emotionalTone: pick(TONES),
						fullTranscript: [],
					})
					.returning({ id: schema.conversations.id });

				await db.insert(schema.messages).values(
					Array.from({ length: NUM_MESSAGES_PER_CONVERSATION }, (_, m) => ({
						conversationId: conv.id,
						sender: m % 2 === 0 ? ("user" as const) : ("assistant" as const),
						content: `Mensagem de teste ${m + 1} da conversa ${k + 1}.`,
						timestamp: new Date(createdAt.getTime() + m * 30_000),
					})),
				);
			}

			// Memory facts with embeddings
			const factsToInsert = Array.from(
				{ length: NUM_FACTS_PER_SENIOR },
				(_, f) => ({
					seniorId: userId,
					content: SAMPLE_FACTS[f % SAMPLE_FACTS.length],
					embedding: randomEmbedding(),
				}),
			);
			for (const fact of factsToInsert) {
				await db.insert(schema.seniorInsights).values(fact);
			}

			process.stdout.write(
				`\r   Seniors: institution ${i + 1}/${NUM_INSTITUTIONS}, senior ${j + 1}/${NUM_SENIORS_PER_INSTITUTION}`,
			);
		}
	}
	console.log();

	// Summary
	const [{ seniors }] = await db.execute<{ seniors: string }>(
		sql`SELECT COUNT(*)::text AS seniors FROM senior`,
	);
	const [{ convs }] = await db.execute<{ convs: string }>(
		sql`SELECT COUNT(*)::text AS convs FROM conversations`,
	);
	const [{ facts }] = await db.execute<{ facts: string }>(
		sql`SELECT COUNT(*)::text AS facts FROM senior_insights`,
	);

	console.log("\n✅ Seed complete");
	console.log(
		`   Seniors: ${seniors} | Conversations: ${convs} | Facts: ${facts}`,
	);
	console.log("\n📋 Test credentials (all passwords: password123)");
	console.log(`   Admin:     ${adminEmail}`);
	console.log(`   Caregiver: caregiver_0_0@loadtest.local`);
	console.log(`   Senior:    senior_0_0@loadtest.local`);

	await pool.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
