import { createLazyFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createLazyFileRoute(
	"/$lang/_app/_app/_caretaker/caretaker/notes/$residentId",
)({
	component: RouteComponent,
});

function RouteComponent() {
	const { residentId, lang } = Route.useParams();
	const router = useRouter();

	useEffect(() => {
		void router.navigate({
			to: "/$lang/caretaker/seniors/$residentId",
			params: { lang, residentId },
			search: () => ({ tab: "notas" }),
			replace: true,
		});
	}, [router, lang, residentId]);

	return null;
}
