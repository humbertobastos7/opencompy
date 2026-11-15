import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSession } from "@/frontend/stores/session";
import AlarmRinging from "@/frontend/components/alarms/alarmRinging";

export const Route = createFileRoute("/$lang/_app/_app/_senior")({
	beforeLoad: async ({ params }) => {
		const session = await getSession();
		if (!session.data) {
			throw new Error(session.error);
		}
		// Onboarding not completed — send back to welcome
		if (!session.data.user.termsAcceptedAt) {
			throw redirect({
				to: "/$lang/senior-welcome",
				params: { lang: params.lang },
			});
		}
	},
	component: Layout,
});

function Layout() {
	const { lang } = Route.useParams();

	return (
		<div className="w-full h-full flex flex-col">
			<Outlet />
			<AlarmRinging lang={lang} />
		</div>
	);
}
