import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession } from "@/frontend/stores/session";

export const Route = createFileRoute("/$lang/_app/_app/senior-welcome")({
	beforeLoad: async ({ params }) => {
		const session = await getSession();
		if (!session.data) {
			throw new Error(session.error);
		}
		// Already completed onboarding — skip to main screen
		if (session.data.user.termsAcceptedAt) {
			throw redirect({ to: "/$lang/senior", params: { lang: params.lang } });
		}
	},
});
