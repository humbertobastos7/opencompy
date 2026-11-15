import { createLazyFileRoute } from "@tanstack/react-router";
import { SeniorWelcomeFlow } from "@/frontend/components/senior-welcome/SeniorWelcomeFlow";

export const Route = createLazyFileRoute("/$lang/_app/_app/senior-welcome")({
	component: SeniorWelcomePage,
});

function SeniorWelcomePage() {
	const { lang } = Route.useParams();
	return (
		<div className="h-full w-full flex flex-col">
			<SeniorWelcomeFlow lang={lang} />
		</div>
	);
}
