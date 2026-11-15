import { useEffect, useRef } from "react";
import { dictionary } from "../../assets/i18n";
import OnboardingForm, {
	type OnboardingRef,
} from "../onboarding/onboardingForm";

interface Props {
	lang: string;
}

const CaretakerSeniorRegistrationDialog: React.FC<Props> = ({ lang }) => {
	const t = dictionary(lang);

	const dialogRef = useRef<HTMLDialogElement>(null);
	const onboardingRef = useRef<OnboardingRef>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: They are all listed
	useEffect(() => {
		document.addEventListener("keydown", (e) => {
			if (e.key !== "Escape") return;
			if (dialogRef.current?.open) e.preventDefault();
		});
	}, [dialogRef.current?.open]);

	return (
		<>
			<button
				type="button"
				className="btn btn-primary w-[50vw] max-w-64 flex flex-col justify-center gap-4"
				onClick={() => dialogRef.current?.showModal()}
			>
				<p style={{ lineHeight: "1rem" }} className="text-lg">
					{t.backoffice.register_new_senior}
				</p>
			</button>
			<dialog
				className="modal p-4"
				ref={dialogRef}
				onClose={() => {
					setTimeout(() => {
						onboardingRef.current?.refresh();
					}, 500);
				}}
			>
				<div className="modal-box bg-base-300 w-full max-w-screen-md p-4">
					<h3 className="font-bold text-lg pb-6">
						{t.backoffice.register_new_senior}
					</h3>
					<div className="w-full h-[70vh] flex flex-col">
						<OnboardingForm
							lang={lang}
							onClose={() => dialogRef.current?.close()}
							ref={onboardingRef}
						/>
					</div>
				</div>
			</dialog>
		</>
	);
};

export default CaretakerSeniorRegistrationDialog;
