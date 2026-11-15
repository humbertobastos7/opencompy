import { useState } from "react";
import { DS } from "@/frontend/designSystem";
import { dictionary } from "@/frontend/assets/i18n";
import { api_client } from "@/frontend/utils/api";
import { toast } from "react-toastify";
import { FaCircleCheck } from "react-icons/fa6";
import { IoCopyOutline } from "react-icons/io5";

interface Props {
	dialogRef: React.RefObject<HTMLDialogElement | null>;
	lang: string;
}

const AddSeniorModal: React.FC<Props> = ({ dialogRef, lang }) => {
	const t = dictionary(lang);

	const [fullName, setFullName] = useState("");
	const [fullNameError, setFullNameError] = useState("");
	const [loading, setLoading] = useState(false);
	const [accessCode, setAccessCode] = useState<string | null>(null);

	const validateFullName = () => {
		if (fullName.trim() === "") {
			setFullNameError(t.onboarding.full_name_required);
			return false;
		}
		if (!/^[a-zA-Z\sáéíóúÁÉÍÓÚãõâêîôûàèìòùäëïöüçÇñÑ]+$/.test(fullName)) {
			setFullNameError(t.onboarding.full_name_invalid_chars);
			return false;
		}
		setFullNameError("");
		return true;
	};

	const handleSubmit = async () => {
		if (!validateFullName()) return;
		setLoading(true);
		const res = await api_client.onboarding.$post({
			json: { fullName },
		});
		if (!res.ok) {
			const err = (await res.json()).message ?? res.statusText;
			toast.error(
				`${t.onboarding.error_saving_personal_info}: ${(t.errors as Record<string, string>)[err] ?? err}`,
			);
			setLoading(false);
			return;
		}
		const data = await res.json();
		setAccessCode(data.accessCode);
		setLoading(false);
	};

	const handleClose = () => {
		setFullName("");
		setFullNameError("");
		setAccessCode(null);
		dialogRef.current?.close();
	};

	return (
		<dialog ref={dialogRef} className="modal">
			<div
				className="modal-box flex flex-col gap-6"
				style={{ ...DS.glassCard, padding: 24 }}
			>
				{accessCode ? (
					<>
						<div className="flex gap-4 items-center">
							<FaCircleCheck size={28} className="text-success flex-shrink-0" />
							<h3 className="text-xl font-bold">
								{t.onboarding.success_adding_senior}
							</h3>
						</div>
						<p className="text-center text-sm">
							{t.onboarding.provide_the_code_below}
						</p>
						<div
							className="flex items-center gap-3 rounded-xl px-4 py-3"
							style={{ background: "rgba(31,181,181,0.08)", border: "1.5px solid rgba(31,181,181,0.2)" }}
						>
							<span className="flex-1 font-mono text-lg font-bold tracking-widest text-center select-all">
								{accessCode}
							</span>
							<button
								type="button"
								title="Copiar"
								className="btn btn-ghost btn-sm btn-square"
								onClick={() => navigator.clipboard.writeText(accessCode ?? "")}
							>
								<IoCopyOutline size={18} />
							</button>
						</div>
						<div className="flex justify-end">
							<button type="button" style={DS.btnPrimary} onClick={handleClose}>
								{t.common.close}
							</button>
						</div>
					</>
				) : (
					<>
						<h3 className="text-xl font-bold">Adicionar sénior</h3>
						<label className="form-control w-full">
							<div className="label">
								<span className="label-text">{t.onboarding.full_name}*</span>
							</div>
							<input
								type="text"
								className="w-full"
								style={DS.formInput}
								value={fullName}
								onChange={(e) => setFullName(e.target.value)}
								onBlur={validateFullName}
								disabled={loading}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSubmit();
								}}
							/>
							{fullNameError && (
								<div className="text-red-500 text-sm mt-1">{fullNameError}</div>
							)}
						</label>
						<div className="flex gap-3 justify-end">
							<button
								type="button"
								style={DS.btnGhost}
								onClick={handleClose}
								disabled={loading}
							>
								{t.common.close}
							</button>
							<button
								type="button"
								style={DS.btnPrimary}
								onClick={handleSubmit}
								disabled={loading || !fullName.trim()}
							>
								{loading && (
									<span className="loading loading-spinner loading-xs" />
								)}
								{t.common.continue}
							</button>
						</div>
					</>
				)}
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="submit" onClick={handleClose}>
					close
				</button>
			</form>
		</dialog>
	);
};

export default AddSeniorModal;
