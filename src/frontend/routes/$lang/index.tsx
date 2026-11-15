import { createFileRoute, redirect } from "@tanstack/react-router";
import { getSession, setSessionState } from "@/frontend/stores/session";

/**
 * Entry point of the app. There is no login: the first time the app is
 * opened the person goes through onboarding; afterwards it opens straight on
 * the conversation screen.
 */
export const Route = createFileRoute("/$lang/")({
	beforeLoad: async ({ params }) => {
		const session = await getSession();
		if (!session.data) {
			throw new Error(session.error);
		}
		setSessionState(session.data);

		if (session.data.user.termsAcceptedAt) {
			throw redirect({ to: "/$lang/senior", params: { lang: params.lang } });
		}
		throw redirect({
			to: "/$lang/senior-welcome",
			params: { lang: params.lang },
		});
	},
	component: () => null,
});
