import { createFileRoute } from "@tanstack/react-router";
import { dictionary } from "@/frontend/assets/i18n";
import OnboardingForm from "@/frontend/components/onboarding/onboardingForm";
import { useRouter } from "@tanstack/react-router";

const CaretakerRegistration: React.FC = () => {
	const { lang } = Route.useParams();
	const t = dictionary(lang);
	const router = useRouter();

	return (
		<div className="w-full h-full p-4 flex flex-col items-center">
			<div className="flex w-full justify-center items-center">
				{/* <div className="rounded-box overflow-clip bg-base-300">
					<button
						type='button'
						onClick={() => {
							router.navigate({
								to: "/$lang/caretaker",
								params: {
									lang,
								},
							});
						}}
						className="btn btn-ghost"
					>
						<IoIosArrowBack />
					</button>
				</div> */}
				<h3 className="font-bold text-lg">
					{t.backoffice.register_new_senior}
				</h3>
				{/* <div className='w-12'/> */}
			</div>
			<div
				style={{ height: "calc(100vh - 8rem)" }}
				className="w-full max-w-screen-md p-4 flex flex-col"
			>
				<OnboardingForm
					lang={lang}
					onClose={() => {
						router.navigate({
							to: "/$lang/caretaker",
							params: {
								lang,
							},
						});
					}}
				/>
			</div>
		</div>
	);
};

export const Route = createFileRoute(
	"/$lang/_app/_app/_caretaker/caretaker/register",
)({
	component: CaretakerRegistration,
});
