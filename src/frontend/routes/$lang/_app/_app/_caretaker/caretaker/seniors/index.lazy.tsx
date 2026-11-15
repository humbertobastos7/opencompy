import { createLazyFileRoute, useNavigate } from "@tanstack/react-router";
import { dictionary } from "@/frontend/assets/i18n";
import { useEffect, useState } from "react";
import { api_client } from "@/frontend/utils/api";
import { usePageBackgroundStore } from "@/frontend/stores/pageBackground";
import { toast } from "react-toastify";
import type { CaregiverDashboardResponse } from "@/shared/contracts";
import type { CSSProperties } from "react";

export const Route = createLazyFileRoute(
	"/$lang/_app/_app/_caretaker/caretaker/seniors/",
)({
	component: RouteComponent,
});

const styles: Record<string, CSSProperties> = {
	screen: {
		height: "100%",
		minHeight: "100%",
		maxHeight: "100%",
		width: "100%",
		background:
			"radial-gradient(circle at 12% 24%, rgba(255,252,226,0.96) 0%, rgba(255,252,226,0.74) 24%, rgba(255,252,226,0.18) 42%, rgba(255,252,226,0) 58%), radial-gradient(circle at 92% 80%, rgba(185,235,220,0.86) 0%, rgba(185,235,220,0.52) 18%, rgba(185,235,220,0.14) 36%, rgba(185,235,220,0) 54%), linear-gradient(135deg, #fffce2 0%, #ffffff 52%, #b9ebdc 100%)",
		display: "flex",
		justifyContent: "center",
		overflow: "hidden",
	},
	safe: {
		position: "relative",
		width: "100%",
		height: "100%",
		minHeight: "100%",
		padding: "0 18px 32px",
		boxSizing: "border-box",
		overflowY: "auto",
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
	},
	bgGlowOne: {
		position: "fixed",
		width: 240,
		height: 240,
		borderRadius: "50%",
		background: "rgba(255, 252, 226, 0.58)",
		filter: "blur(28px)",
		left: "22%",
		top: "6%",
		transform: "translateX(-50%)",
		pointerEvents: "none",
		zIndex: 0,
	},
	bgGlowTwo: {
		position: "fixed",
		width: 200,
		height: 200,
		borderRadius: "50%",
		background: "rgba(255, 255, 255, 0.52)",
		filter: "blur(24px)",
		left: "51%",
		top: "46%",
		transform: "translateX(-50%)",
		pointerEvents: "none",
		zIndex: 0,
	},
	bgGlowThree: {
		position: "fixed",
		width: 180,
		height: 180,
		borderRadius: "50%",
		background: "rgba(255, 252, 226, 0.34)",
		filter: "blur(26px)",
		right: -50,
		top: 130,
		pointerEvents: "none",
		zIndex: 0,
	},
};

/**
 * Formats the last conversation timestamp using the fixed pt-PT relative wording.
 */
function timeAgo(dateString: string | null): string {
	if (!dateString) return "—";
	const diffMs = Date.now() - new Date(dateString).getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);
	const diffWeeks = Math.floor(diffDays / 7);
	const diffMonths = Math.floor(diffDays / 30);

	if (diffMins < 60) return `há ${diffMins} min`;
	if (diffHours < 24)
		return `há ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
	if (diffDays < 7) return `há ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
	if (diffWeeks < 4)
		return `há ${diffWeeks} ${diffWeeks === 1 ? "semana" : "semanas"}`;
	return `há ${diffMonths} ${diffMonths === 1 ? "mês" : "meses"}`;
}

type SortOrder = "recent" | "name";
type DashboardSenior = CaregiverDashboardResponse["seniors"][number];

/**
 * Renders the caregiver senior list using the fixed Portuguese locale and vocabulary.
 */
function RouteComponent() {
	const { lang } = Route.useParams();
	const navigate = useNavigate();
	const t = dictionary(lang);
	const globalBackground = usePageBackgroundStore((s) => s.globalBackground);

	const [seniors, setSeniors] = useState<DashboardSenior[]>([]);
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<SortOrder>("recent");
	const [loading, setLoading] = useState(true);

	// biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
	useEffect(() => {
		const load = async () => {
			const res = await api_client.caregiver.dashboard.$get();
			if (!res.ok) {
				const payload = await res.json().catch(() => ({}));
				toast.error(
					(payload as { message?: string }).message ?? res.statusText,
				);
				setLoading(false);
				return;
			}
			const data = (await res.json()) as CaregiverDashboardResponse;
			setSeniors(data.seniors);
			setLoading(false);
		};
		void load();
	}, []);

	const normalize = (s: string) =>
		s
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "");

	const filtered = seniors
		.filter((s) => normalize(s.fullName).includes(normalize(search)))
		.sort((a, b) => {
			if (sort === "name") return a.fullName.localeCompare(b.fullName);
			const aTime = a.lastConversationAt
				? new Date(a.lastConversationAt).getTime()
				: 0;
			const bTime = b.lastConversationAt
				? new Date(b.lastConversationAt).getTime()
				: 0;
			return bTime - aTime;
		});

	const initial = (name: string) => name.trim()[0]?.toUpperCase() ?? "?";

	return (
		<div
			style={{
				...styles.screen,
				background: globalBackground ?? styles.screen.background,
			}}
		>
			<div style={styles.bgGlowOne} />
			<div style={styles.bgGlowTwo} />
			<div style={styles.bgGlowThree} />

			<div style={styles.safe}>
				{/* Logo */}
				<div
					className="flex justify-center pt-4 pb-2"
					style={{ position: "relative", zIndex: 1 }}
				>
					<img
						src="/logoUI.png"
						alt="Compy"
						style={{ height: 64 }}
						className="object-contain drop-shadow-sm"
					/>
				</div>

				{/* Back + Title */}
				<div
					className="w-full mt-2"
					style={{ position: "relative", zIndex: 1, maxWidth: 960 }}
				>
					<button
						type="button"
						onClick={() =>
							navigate({ to: "/$lang/caretaker", params: { lang } })
						}
						className="flex items-center gap-1 text-sm mb-3 transition-opacity hover:opacity-70"
						style={{ color: "rgba(255,255,255,0.9)" }}
					>
						← Voltar
					</button>
					<h1 className="text-2xl font-bold" style={{ color: "#fff" }}>
						Os meus seniores
					</h1>
					<p
						className="text-sm mt-1"
						style={{ color: "rgba(255,255,255,0.75)" }}
					>
						{loading
							? "..."
							: `${seniors.length} ${seniors.length === 1 ? "sénior associado" : "seniores associados"}`}
					</p>
				</div>

				{/* Filters row */}
				<div
					className="w-full flex gap-3 mt-5 mb-5"
					style={{ position: "relative", zIndex: 1, maxWidth: 960 }}
				>
					<input
						type="text"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t.common.search}
						className="flex-1 rounded-xl px-4 py-2 text-sm focus:outline-none"
						style={{
							backgroundColor: "rgba(255,255,255,0.85)",
							color: "#1a5f5a",
						}}
					/>
					<select
						value={sort}
						onChange={(e) => setSort(e.target.value as SortOrder)}
						className="rounded-xl px-3 py-2 text-sm focus:outline-none cursor-pointer"
						style={{
							backgroundColor: "rgba(255,255,255,0.85)",
							color: "#1a5f5a",
						}}
					>
						<option value="recent">Mais recente</option>
						<option value="name">Nome</option>
					</select>
				</div>

				{/* Grid */}
				{loading ? (
					<div
						className="flex justify-center mt-12"
						style={{ position: "relative", zIndex: 1 }}
					>
						<span
							className="loading loading-spinner loading-lg"
							style={{ color: "#fff" }}
						/>
					</div>
				) : (
					<div
						className="w-full grid gap-4"
						style={{
							position: "relative",
							zIndex: 1,
							maxWidth: 960,
							gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
						}}
					>
						{filtered.map((senior) => (
							<div
								key={senior.seniorId}
								className="rounded-2xl p-4 shadow-md flex items-center gap-4"
								style={{ backgroundColor: "#dff5f3" }}
							>
								{/* Avatar */}
								<div
									className="flex-shrink-0 flex items-center justify-center rounded-full font-bold text-white"
									style={{
										width: 48,
										height: 48,
										backgroundColor: "#1a5f5a",
										fontSize: 20,
									}}
								>
									{initial(senior.fullName)}
								</div>

								{/* Info */}
								<div className="flex-1 min-w-0">
									<div
										className="font-bold truncate"
										style={{ color: "#1a5f5a" }}
									>
										{senior.fullName}
									</div>
									<div
										className="text-xs mt-0.5 truncate"
										style={{ color: "#2a7a74" }}
									>
										{senior.nickname !== senior.fullName
											? senior.nickname
											: "\u00a0"}
									</div>
									<div className="text-xs mt-1" style={{ color: "#3a8a84" }}>
										{timeAgo(senior.lastConversationAt)}
									</div>
								</div>

								{/* Action */}
								<button
									type="button"
									onClick={() =>
										navigate({
											to: "/$lang/caretaker/seniors/$residentId",
											params: { lang, residentId: senior.seniorId },
											search: { tab: undefined },
										})
									}
									className="flex-shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-80"
									style={{ backgroundColor: "#1a5f5a" }}
								>
									Ver perfil
								</button>
							</div>
						))}

						{filtered.length === 0 && (
							<div
								className="col-span-full text-center py-12 text-sm"
								style={{ color: "rgba(255,255,255,0.7)" }}
							>
								Nenhum sénior encontrado.
							</div>
						)}
					</div>
				)}

				<div style={{ height: 32 }} />
			</div>
		</div>
	);
}
