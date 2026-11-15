import { useState } from "react";
import { dictionary } from "../../assets/i18n";
import { toast } from "react-toastify";
import { api_client } from "../../utils/api";
import { useSessionStore } from "../../stores/session";

interface Props {
	lang: string;
	dialogRef: React.RefObject<HTMLDialogElement | null>;
}

const ChangeNicknameDialog: React.FC<Props> = ({ lang, dialogRef }) => {
	const t = dictionary(lang);

	const { session } = useSessionStore();

	const [nickname, setNickname] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!session) return;

		const res = await api_client.seniors[":seniorId"].nickname.$patch({
			json: {
				nickname,
			},
			param: {
				seniorId: session.user.id,
			},
		});

		if (!res.ok) {
			const err = (await res.json()).message ?? res.statusText;
			toast.error(
				`${t.onboarding.error_updating_nickname}: ${(t.errors as Record<string, string>)[err] ?? err}`,
			);
			return;
		}

		toast.success(t.onboarding.success_updating_nick);
		dialogRef.current?.close();
	};

	return (
		<dialog
			className="modal p-4 w-full"
			ref={dialogRef}
			onClose={() => {
				setNickname("");
			}}
		>
			<div className="modal-box bg-base-300 w-full max-w-screen-sm p-2">
				<h3 className="font-bold text-lg p-4 pb-6">
					{t.onboarding.change_nickname}
				</h3>

				<form onSubmit={handleSubmit} className="flex flex-col gap-6 px-6">
					<label className="input input-bordered flex items-center gap-2">
						<input
							type="text"
							className="grow"
							placeholder={t.onboarding.nickname}
							value={nickname}
							onChange={(e) => setNickname(e.target.value)}
						/>
					</label>

					<div className="modal-action pb-4">
						<button
							type="button"
							className="btn"
							onClick={() => {
								dialogRef.current?.close();
							}}
						>
							{t.common.close}
						</button>
						<button
							type="submit"
							className="btn btn-primary"
							disabled={!nickname}
						>
							{t.common.save}
						</button>
					</div>
				</form>
			</div>
		</dialog>
	);
};

export default ChangeNicknameDialog;
