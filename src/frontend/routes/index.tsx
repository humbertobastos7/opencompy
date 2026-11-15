import { createFileRoute, redirect } from "@tanstack/react-router";

const PORTUGUESE_EUROPEAN_LOCALE = "pt-PT";

export const Route = createFileRoute("/")({
	component: RouteComponent,
	beforeLoad: async () => {
		return redirect({
			to: "/$lang",
			params: {
				lang: PORTUGUESE_EUROPEAN_LOCALE,
			},
		});
	},
});

/**
 * Keeps the root route empty because users are always redirected to the fixed pt-PT path.
 */
function RouteComponent() {
	return <div />;
}
