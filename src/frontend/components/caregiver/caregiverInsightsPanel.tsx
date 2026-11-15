import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import type {
	CaregiverDashboardResponse,
	CaregiverSeniorActivityResponse,
	CaregiverSeniorSummaryResponse,
} from "@/shared/contracts";
import { api_client } from "@/frontend/utils/api";
import { readApiError } from "@/frontend/utils/apiErrors";
import { DS } from "@/frontend/designSystem";

type DashboardProps = {
	lang: string;
};

type DetailProps = {
	lang: string;
	seniorId: string;
};

export function CaregiverDashboardPanel({ lang }: DashboardProps) {
	const [dashboard, setDashboard] = useState<CaregiverDashboardResponse | null>(
		null,
	);

	useEffect(() => {
		const loadDashboard = async () => {
			const res = await api_client.caregiver.dashboard.$get();
			if (!res.ok) {
				toast.error(await readApiError(res, lang));
				return;
			}
			setDashboard((await res.json()) as CaregiverDashboardResponse);
		};

		void loadDashboard();
	}, []);

	if (!dashboard) {
		return (
			<div className="rounded-2xl p-4" style={DS.solidCard}>
				<div className="skeleton-premium rounded-xl" style={{ height: 80 }} />
			</div>
		);
	}

	return (
		<div className="w-full px-4">
			<div className="rounded-box bg-base-300 p-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-2xl font-black">Caregiver Dashboard</h2>
						<p className="text-sm opacity-70">
							Live view of the seniors you currently manage.
						</p>
					</div>
					<div className="badge badge-outline badge-lg">
						{lang.toUpperCase()}
					</div>
				</div>
				<div className="mt-4 grid gap-3 md:grid-cols-3">
					{[
						["Seniors", dashboard.totalSeniors],
						["Conversations", dashboard.totalConversations],
					].map(([label, value]) => (
						<div key={label} className="rounded-box bg-base-100 p-4">
							<div className="text-xs uppercase tracking-[0.2em] opacity-60">
								{label}
							</div>
							<div className="pt-2 text-3xl font-black">{value}</div>
						</div>
					))}
				</div>
				<div className="mt-4 grid gap-3 lg:grid-cols-2">
					{dashboard.seniors.map((senior) => (
						<div key={senior.seniorId} className="rounded-box bg-base-100 p-4">
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="text-lg font-bold">{senior.nickname}</div>
									<div className="text-sm opacity-70">{senior.fullName}</div>
								</div>
								<div className="badge badge-primary badge-outline">
									{senior.conversationCount} chats
								</div>
							</div>
							<div className="mt-3 grid grid-cols-1 gap-3 text-sm">
								<div className="rounded-box bg-base-200 p-3">
									<div className="opacity-60">Last Conversation</div>
									<div className="pt-1 font-semibold">
										{senior.lastConversationAt
											? new Date(senior.lastConversationAt).toLocaleString()
											: "No data"}
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export function CaregiverSeniorInsightsPanel({ lang, seniorId }: DetailProps) {
	const [summary, setSummary] = useState<CaregiverSeniorSummaryResponse | null>(
		null,
	);
	const [activity, setActivity] =
		useState<CaregiverSeniorActivityResponse | null>(null);
	const [note, setNote] = useState("");
	const [saving, setSaving] = useState(false);

	const loadPanel = async () => {
		const [summaryRes, activityRes] = await Promise.all([
			api_client.caregiver.seniors[":seniorId"].summary.$get({
				param: { seniorId },
			}),
			api_client.caregiver.seniors[":seniorId"].activity.$get({
				param: { seniorId },
			}),
		]);

		if (!summaryRes.ok || !activityRes.ok) {
			const failingResponse = (!summaryRes.ok && summaryRes) || activityRes;
			toast.error(await readApiError(failingResponse, lang));
			return;
		}

		setSummary((await summaryRes.json()) as CaregiverSeniorSummaryResponse);
		setActivity((await activityRes.json()) as CaregiverSeniorActivityResponse);
	};

	useEffect(() => {
		void loadPanel();
	}, [seniorId]);

	const createNote = async () => {
		if (!note.trim()) {
			return;
		}

		setSaving(true);
		const res = await api_client.caregiver.seniors[":seniorId"].notes.$post({
			param: { seniorId },
			json: { content: note.trim() },
		});
		setSaving(false);

		if (!res.ok) {
			toast.error(await readApiError(res, lang));
			return;
		}

		setNote("");
		toast.success("Note saved");
		await loadPanel();
	};

	return (
		<div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
			<div className="rounded-2xl p-4" style={DS.solidCard}>
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					{[
						["Conversations", summary?.conversationCount ?? 0],
						[
							"Avg Duration",
							`${summary?.averageConversationDurationMinutes ?? 0} min`,
						],
						["Notes", summary?.notesCount ?? 0],
					].map(([label, value]) => (
						<div key={label} className="rounded-xl p-4" style={DS.glassCard}>
							<div
								className="text-xs font-semibold uppercase tracking-[0.2em]"
								style={{ color: DS.C.teal600, opacity: 0.75 }}
							>
								{label}
							</div>
							<div
								className="pt-2 text-2xl font-black"
								style={{ color: DS.C.teal800 }}
							>
								{value}
							</div>
						</div>
					))}
				</div>
				<div className="mt-4 grid gap-3 md:grid-cols-2">
					<div className="rounded-xl p-4" style={DS.glassCard}>
						<div
							className="text-xs font-semibold uppercase tracking-[0.2em]"
							style={{ color: DS.C.teal600, opacity: 0.75 }}
						>
							Last Conversation
						</div>
						<div
							className="pt-2 text-lg font-bold"
							style={{ color: DS.C.teal800 }}
						>
							{summary?.lastConversationAt
								? new Date(summary.lastConversationAt).toLocaleString()
								: "No data yet"}
						</div>
					</div>
				</div>
				<div className="mt-4 rounded-xl p-4" style={DS.glassCard}>
					<div
						className="text-sm font-bold uppercase tracking-[0.2em] mb-3"
						style={{ color: DS.C.teal600, opacity: 0.75 }}
					>
						Add Caregiver Note
					</div>
					<textarea
						className="mt-1 h-28 w-full resize-none"
						style={{ ...DS.formInput, height: 112 }}
						placeholder="Capture a relevant observation for the care team."
						value={note}
						onChange={(event) => setNote(event.target.value)}
					/>
					<div className="mt-3 flex justify-end">
						<button
							type="button"
							style={{
								...DS.btnPrimary,
								opacity: saving || !note.trim() ? 0.6 : 1,
							}}
							onClick={() => void createNote()}
							disabled={saving || !note.trim()}
						>
							{saving ? "Saving..." : "Save Note"}
						</button>
					</div>
				</div>
			</div>

			<div className="rounded-2xl p-4" style={DS.solidCard}>
				<div className="mb-3 flex items-center justify-between">
					<h3 className="text-lg font-bold" style={{ color: DS.C.teal800 }}>
						Recent Activity
					</h3>
					<span
						className="text-xs font-semibold px-3 py-1 rounded-full"
						style={{ backgroundColor: DS.C.teal100, color: DS.C.teal700 }}
					>
						{activity?.items.length ?? 0} events
					</span>
				</div>
				<div className="flex max-h-[38rem] flex-col gap-3 overflow-auto pr-1">
					{activity?.items.map((item, index) => (
						<div
							key={`${item.timestamp}-${index}`}
							className="rounded-xl p-4"
							style={DS.glassCard}
						>
							<div className="flex items-center justify-between gap-3">
								<div
									className="text-xs font-bold uppercase tracking-[0.15em]"
									style={{ color: DS.C.teal600, opacity: 0.75 }}
								>
									{item.type.replaceAll("_", " ")}
								</div>
								<div
									className="text-xs"
									style={{ color: DS.C.teal600, opacity: 0.6 }}
								>
									{new Date(item.timestamp).toLocaleString()}
								</div>
							</div>
							<div
								className="pt-2 text-base font-bold"
								style={{ color: DS.C.teal800 }}
							>
								{item.title}
							</div>
							<div
								className="pt-1 text-sm"
								style={{ color: DS.C.text, opacity: 0.8 }}
							>
								{item.description}
							</div>
						</div>
					))}
					{!activity?.items.length && (
						<div
							className="rounded-xl p-4 text-sm empty-state"
							style={{ ...DS.glassCard, color: DS.C.teal600 }}
						>
							No activity available for this senior yet.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
