import { ScrollShadow } from "@nextui-org/scroll-shadow";
import { DS } from "@/frontend/designSystem";
import { dictionary } from "../../assets/i18n";
import { useState } from "react";
import { useSessionStore } from "../../stores/session";

interface Props {
	onNextStep?: () => void;
	onPreviousStep?: () => void;
	lang: string;
	existingEmail?: string;
	submitOnboarding: (v: {
		birthDate: string;
		fullName: string;
		nickname: string;
		email: string;
	}) => Promise<void>;
	loading: boolean;
	onClose?: () => void;
	onSkip?: () => void;
}

export const PersonalInfoForm: React.FC<Props> = ({
	onNextStep,
	onPreviousStep,
	lang,
	existingEmail,
	submitOnboarding,
	loading,
	onClose,
	onSkip,
}) => {
	const t = dictionary(lang);

	const { session } = useSessionStore();

	const [fullName, setFullName] = useState("");
	const [nickname, setNickname] = useState("");
	const [birthDate, setBirthDate] = useState("");
	const [email, setEmail] = useState("");
	const [birthDateError, setBirthDateError] = useState("");
	const [emailError, setEmailError] = useState("");
	const [fullNameError, setFullNameError] = useState("");
	const [nicknameError, setNicknameError] = useState("");

	const validateBirthDate = () => {
		const date = new Date(birthDate);
		const minDate = new Date("1900-01-01");
		const eighteenYearsAgo = new Date();
		eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
		if (date > eighteenYearsAgo) {
			setBirthDateError(t.onboarding.age_under_18);
		}
		const maxDate = new Date();
		if (date < minDate || date > maxDate) {
			setBirthDateError(t.onboarding.invalid_birthdate);
		} else {
			setBirthDateError("");
		}
	};

	const validateEmail = () => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			setEmailError(t.onboarding.invalid_email);
		} else {
			setEmailError("");
		}
	};

	const validateFullName = () => {
		if (fullName.trim() === "") {
			setFullNameError(t.onboarding.full_name_required);
		} else if (!/^[a-zA-Z\sáéíóúÁÉÍÓÚãõâêîôûàèìòùäëïöüçÇñÑ]+$/.test(fullName)) {
			setFullNameError(t.onboarding.full_name_invalid_chars);
		} else {
			setFullNameError("");
		}
	};

	const validateNickname = () => {
		if (!/^[a-zA-Z\sáéíóúÁÉÍÓÚãõâêîôûàèìòùäëïöüçÇñÑ]*$/.test(nickname)) {
			setNicknameError(t.onboarding.nickname_invalid_chars);
		} else {
			setNicknameError("");
		}
	};

	return (
		<div className="w-full h-full flex flex-col justify-between items-center p-4">
			<ScrollShadow
				size={32}
				className="w-full flex-grow flex flex-col overflow-y-auto overflow-x-clip items-center gap-2 pb-8 px-1"
			>
				{!existingEmail && (
					<label className="form-control w-full max-w-xs">
						<div className="label">
							<span className="label-text">{t.onboarding.email}*</span>
						</div>
						<input
							type="email"
							className="w-full max-w-xs"
							style={DS.formInput}
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							onBlur={validateEmail}
							disabled={loading}
						/>
						{emailError && (
							<span className="text-red-500 text-sm">{emailError}</span>
						)}
					</label>
				)}

				{session?.user.role !== "senior" && (
					<label className="form-control w-full max-w-xs">
						<div className="label">
							<span className="label-text">{t.onboarding.full_name}*</span>
						</div>
						<input
							type="text"
							className="w-full max-w-xs"
							style={DS.formInput}
							value={fullName}
							onChange={(e) => setFullName(e.target.value)}
							onBlur={validateFullName}
							disabled={loading}
						/>
						{fullNameError && (
							<div className="text-red-500 text-sm">{fullNameError}</div>
						)}
					</label>
				)}

				<label className="form-control w-full max-w-xs">
					<div className="label">
						<span className="label-text">{t.onboarding.nickname}</span>
					</div>
					<input
						type="text"
						className="w-full max-w-xs"
						style={DS.formInput}
						value={nickname}
						onChange={(e) => setNickname(e.target.value)}
						onBlur={validateNickname}
						disabled={loading}
					/>
					{nicknameError && (
						<div className="text-red-500 text-sm">{nicknameError}</div>
					)}
				</label>

				<label className="form-control w-full max-w-xs">
					<div className="label">
						<span className="label-text">{t.onboarding.birthdate}*</span>
					</div>
					<input
						type="date"
						className="w-full max-w-xs"
						style={DS.formInput}
						value={birthDate}
						onChange={(e) => setBirthDate(e.target.value)}
						onBlur={validateBirthDate}
						disabled={loading}
						min="1900-01-01"
						max={
							new Date(
								new Date().getFullYear() - 18,
								new Date().getMonth(),
								new Date().getDate(),
							)
								.toISOString()
								.split("T")[0]
						}
					/>
					{birthDateError && (
						<span className="text-red-500 text-sm">{birthDateError}</span>
					)}
				</label>
			</ScrollShadow>

			<p className="text-sm text-gray-500 text-left w-full pb-1">
				*{t.onboarding.required}
			</p>

			<div className="flex w-full max-w-screen-sm gap-4">
				<button
					type="button"
					style={{ ...DS.btnGhost, flex: 1 }}
					onClick={onPreviousStep}
					disabled={!onPreviousStep || loading}
				>
					{t.common.back}
				</button>
				{!!onClose && (
					<button
						type="button"
						style={{ ...DS.btnGhost, flex: 1 }}
						onClick={onClose}
						disabled={loading}
					>
						{t.common.close}
					</button>
				)}
				{!!onSkip && (
					<button
						type="button"
						style={{ ...DS.btnGhost, flex: 1 }}
						onClick={onSkip}
						disabled={loading}
					>
						{t.common.skip}
					</button>
				)}
				<button
					type="button"
					style={{ ...DS.btnPrimary, flex: 1 }}
					onClick={() =>
						submitOnboarding({
							birthDate,
							fullName:
								session?.user.role !== "senior"
									? fullName
									: (session?.user.name ?? ""),
							nickname,
							email: existingEmail ? existingEmail : email,
						})
					}
					disabled={
						!onNextStep ||
						loading ||
						(session?.user.role !== "senior" && !fullName) ||
						!birthDate ||
						!!birthDateError ||
						(!existingEmail && !email) ||
						!!emailError ||
						(session?.user.role !== "senior" && !!fullNameError) ||
						!!nicknameError
					}
				>
					{loading && <span className="loading loading-spinner loading-xs" />}
					{t.common.continue}
				</button>
			</div>
		</div>
	);
};
