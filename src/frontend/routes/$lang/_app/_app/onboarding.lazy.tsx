import { createLazyFileRoute } from "@tanstack/react-router";
import OnboardingForm from "@/frontend/components/onboarding/onboardingForm";

export const Route = createLazyFileRoute("/$lang/_app/_app/onboarding")({
	component: About,
});

function About() {
	const { lang } = Route.useParams();

	return (
		<div className="h-full w-full flex flex-col">
			<OnboardingForm lang={lang} />
		</div>
	);
}
