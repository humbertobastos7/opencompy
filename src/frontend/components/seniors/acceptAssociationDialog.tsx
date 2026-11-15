import { useEffect, useRef, useState } from "react";
import { dictionary } from "../../assets/i18n";
import { LuMessageCircleWarning } from "react-icons/lu";
import { FaCircleExclamation } from "react-icons/fa6";
import { api_client } from "../../utils/api";
import { toast } from "react-toastify";

interface Props {
	lang: string;
}

const AcceptAssociationDialog: React.FC<Props> = ({ lang }) => {
	const t = dictionary(lang);
	const dialogRef = useRef<HTMLDialogElement>(null);

	const [pending, setPending] = useState(false);
	const [requirerName, setRequirerName] = useState("");

	const fetchAssociationStatus = async () => {
		const res = await api_client.onboarding.status.$get();
		if (!res.ok) {
			const err = (await res.json()).message ?? res.statusText;
			toast.error((t.errors as Record<string, string>)[err] ?? err);
			return;
		}
		const resData = await res.json();
		setPending(!!resData.locationId && !resData.locationApproved);
		setRequirerName(resData.caregiverName);
	};

	useEffect(() => {
		fetchAssociationStatus();
	});

	const respondToAssociation = async (approved: boolean) => {
		const res = await api_client.onboarding["approve-location"].$post({
			json: {
				approved,
			},
		});
		if (!res.ok) {
			const err = (await res.json()).message ?? res.statusText;
			toast.error(
				`${t.onboarding.error_responding_to_association}: ${(t.errors as Record<string, string>)[err] ?? err}`,
			);
			return;
		}
		toast.success(t.onboarding.association_response_sent_successfully);
		setPending(false);
		dialogRef.current?.close();
	};

	return (
		<>
			{pending && (
				<button
					type="button"
					className="btn btn-ghost btn-square relative"
					onClick={() => dialogRef.current?.showModal()}
				>
					<LuMessageCircleWarning className="h-8 w-8" />
					<div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-danger animate-ping" />
					<div className="absolute top-[0.3rem] right-[0.3rem] w-2 h-2 rounded-full bg-danger" />
				</button>
			)}
			<dialog className="modal" ref={dialogRef}>
				<div className="modal-box bg-base-300">
					<h3 className="font-bold text-lg pb-6">{t.common.association}</h3>
					<div className="flex flex-col gap-4 items-center py-8">
						<div className="flex gap-4 items-center">
							<FaCircleExclamation size={32} className="text-warning" />
							<h1 className="text-2xl font-bold">
								{t.onboarding.person_asking_for_association(requirerName)}
							</h1>
						</div>
						<div className="flex flex-col items-center">
							<p className="text-center">
								{t.onboarding.association_explanation_1}
							</p>
							<p className="text-center">
								{t.onboarding.association_explanation_2}
							</p>
						</div>
					</div>
					<div className="modal-action gap-4 justify-between">
						<button
							type="button"
							className="btn"
							onClick={() => {
								dialogRef.current?.close();
							}}
						>
							{t.common.close}
						</button>
						<div className="flex gap-4">
							<button
								type="button"
								className="btn btn-error"
								onClick={() => respondToAssociation(false)}
							>
								{t.onboarding.decline}
							</button>
							<button
								type="button"
								className="btn btn-success"
								onClick={() => respondToAssociation(true)}
							>
								{t.onboarding.accept}
							</button>
						</div>
					</div>
				</div>
			</dialog>
		</>
	);
};

export default AcceptAssociationDialog;
