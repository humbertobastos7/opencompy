import { createFileRoute, Outlet } from "@tanstack/react-router";
import { getSession, setSessionState } from "../../stores/session";

/**
 * Layout for every screen of the app. Loads the local user once per
 * navigation so child routes and components can rely on it being present.
 */
export const Route = createFileRoute("/$lang/_app")({
	beforeLoad: async () => {
		const session = await getSession();
		if (!session.data) {
			// Backend unreachable — handled by the router's error screen.
			throw new Error(session.error);
		}
		setSessionState(session.data);
	},
	component: Layout,
});

function Layout() {
	return (
		<div className="w-full h-full flex flex-col">
			<Outlet />
		</div>
	);
}
