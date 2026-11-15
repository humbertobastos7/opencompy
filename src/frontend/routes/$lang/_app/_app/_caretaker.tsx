import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSession } from "@/frontend/stores/session";
import { api_client } from "@/frontend/utils/api";

export const Route = createFileRoute("/$lang/_app/_app/_caretaker")({
	beforeLoad: async ({ params }) => {
		const session = await getSession();
		if (!session.data) {
			throw redirect({
				to: "/$lang",
				params: { lang: params.lang },
			});
		}

		if (session.data.user.role === "admin") {
			throw redirect({
				to: "/$lang/admin",
				params: { lang: params.lang },
			});
		}

		if (session.data.user.role === "senior") {
			throw redirect({
				to: "/$lang/senior",
				params: { lang: params.lang },
			});
		}

		if (session.data.user.role === "caregiver") {
			try {
				const res = await api_client.caregiver.institution.$get();
				if (res.ok) {
					const institution = (await res.json()) as { type: string };
					if (institution.type === "family") {
						const dashboardRes = await api_client.caregiver.dashboard.$get();
						const dashboard = dashboardRes.ok
							? ((await dashboardRes.json()) as { totalSeniors?: number })
							: null;

						if (!dashboard?.totalSeniors) {
							throw redirect({
								to: "/$lang/caregiver-family-onboarding",
								params: { lang: params.lang },
							});
						}
					}
				}
			} catch (err) {
				if (err && typeof err === "object" && "isRedirect" in err) throw err;
			}
		}
	},
	component: Layout,
});

function Layout() {
	return (
		<div className="w-full h-full">
			<Outlet />
		</div>
	);
}
