import {
	createFileRoute,
	Outlet,
	redirect,
	type ToPathOption,
} from "@tanstack/react-router";

const PORTUGUESE_EUROPEAN_LOCALE = "pt-PT";

export const Route = createFileRoute("/$lang")({
	component: RouteComponent,
	beforeLoad: async ({ params, location }): Promise<void> => {
		if (params.lang === PORTUGUESE_EUROPEAN_LOCALE) return;

		const segments = location.pathname.split("/").filter(Boolean);
		const rest = segments.slice(1).join("/");
		const targetPath = rest ? `/$lang/${rest}` : "/$lang";

		throw redirect({
			to: targetPath as ToPathOption,
			params: {
				lang: PORTUGUESE_EUROPEAN_LOCALE,
			},
			search: location.search,
			hash: location.hash,
		});
	},
});

/**
 * Renders the locale outlet after the route guard has forced the pt-PT path.
 */
function RouteComponent() {
	return <Outlet />;
}
