import { useRef, useState } from "react";
import { dictionary } from "../../assets/i18n";
import PinInput from "../ui/pinInput";
import { FaCircleCheck } from "react-icons/fa6";
import { api_client } from "../../utils/api";
import { toast } from "react-toastify";

interface Props {
	lang: string;
}

const CaretakerSeniorAssociationDialog: React.FC<Props> = ({ lang }) => {
	const t = dictionary(lang);

	const dialogRef = useRef<HTMLDialogElement>(null);

	const [pin, setPin] = useState("");

	const [pane, setPane] = useState<"pin" | "loading" | "success">("pin");

	const associateSenior = async () => {
		setPane("loading");

		const formattedPin = pin.replace(/(.{4})/g, "$1-").slice(0, -1);
		const res = await api_client.onboarding.assign.$post({
			json: {
				accessCode: formattedPin,
			},
		});

		if (!res.ok) {
			setPane("pin");
			setPin("");
			const err = (await res.json()).message ?? res.statusText;
			toast.error(
				`${t.backoffice.senior_association_error}: ${(t.errors as Record<string, string>)[err] ?? err}`,
			);
			return;
		}

		setPane("success");
	};

	return (
		<>
			<button
				type="button"
				className="btn btn-primary w-[50vw] max-w-64 flex flex-col justify-center gap-4"
				onClick={() => dialogRef.current?.showModal()}
			>
				<p style={{ lineHeight: "1rem" }} className="text-lg">
					{t.backoffice.associate_senior}
				</p>
			</button>
			<dialog
				className="modal"
				ref={dialogRef}
				onClose={() => {
					setPin("");
					setTimeout(() => {
						setPane("loading");
						setTimeout(() => {
							setPane("pin");
						}, 10);
					}, 100);
				}}
			>
				<div className="modal-box max-w-screen-sm bg-base-300">
					<h3 className="font-bold text-lg pb-6">
						{t.backoffice.associate_senior}
					</h3>

					{pane === "pin" && (
						<div className="w-full flex flex-col items-center px-4">
							<div className="form-control">
								<div className="label">
									<span className="label-text">{t.common.access_code}</span>
								</div>
								<PinInput pin={pin} setPin={setPin} lang={lang} />
							</div>
						</div>
					)}

					{pane === "loading" && (
						<div className="w-full flex flex-col items-center px-4">
							<span className="loading text-primary loading-spinner loading-lg" />
						</div>
					)}

					{pane === "success" && (
						<div className="flex flex-col gap-4 items-center py-8">
							<div className="flex gap-4 items-center">
								<FaCircleCheck size={32} className="text-success" />
								<h1 className="text-2xl font-bold">
									{t.backoffice.senior_associated_successfully}
								</h1>
							</div>
							<div className="flex flex-col items-center">
								<p className="text-center">
									{t.backoffice.senior_association_explanation_1}
								</p>
								<p className="text-center">
									{t.backoffice.senior_association_explanation_2}
								</p>
							</div>
						</div>
					)}

					<div className="modal-action gap-4">
						<button
							type="button"
							className="btn btn-ghost"
							onClick={() => {
								dialogRef.current?.close();
							}}
						>
							{t.common.close}
						</button>
						<button
							type="button"
							className="btn btn-primary"
							disabled={
								pane === "loading" || pane === "success" || pin.length < 12
							}
							onClick={associateSenior}
						>
							{t.backoffice.associate_senior}
						</button>
					</div>
				</div>
			</dialog>
		</>
	);
};

export default CaretakerSeniorAssociationDialog;
