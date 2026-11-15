import { useNavigate } from "@tanstack/react-router";
import { forwardRef, useImperativeHandle, useState } from "react";

import { useSessionStore } from "@/frontend/stores/session";
import { api_client } from "@/frontend/utils/api";
import { toast } from "react-toastify";
import { dictionary } from "../../assets/i18n";
import { PersonalInfoForm } from "./personalInfoForm";
import { FaCircleCheck } from "react-icons/fa6";
import { DS } from "@/frontend/designSystem";
import PinInput from "../ui/pinInput";

interface Props {
	lang: string;
	onClose?: () => void;
}

export type OnboardingRef = {
	refresh: () => void;
};

const OnboardingForm = forwardRef<OnboardingRef, Props>(
	({ lang, onClose }, ref) => {
		const t = dictionary(lang);
		const { session } = useSessionStore();
		const [step, setStep] = useState(1);

		const navigate = useNavigate();

		const [seniorAccessCode, setSeniorAccessCode] = useState(
			session?.user.accessCode ?? "",
		);
		const [seniorLoading, setSeniorLoading] = useState(false);

		const submitOnboarding = async ({
			birthDate,
			fullName,
			nickname,
			email,
		}: {
			birthDate: string;
			fullName: string;
			nickname: string;
			email: string;
		}) => {
			setSeniorLoading(true);
			const res = await api_client.onboarding.$post({
				json: {
					birthDate: new Date(birthDate),
					fullName,
					nickname,
					email,
				},
			});
			if (!res.ok) {
				const err = (await res.json()).message ?? res.statusText;
				toast.error(
					`${t.onboarding.error_saving_personal_info}: ${(t.errors as Record<string, string>)[err] ?? err}`,
				);
				setSeniorLoading(false);
				return;
			}
			setSeniorLoading(false);

			if (session?.user.role === "senior") {
				navigate({ to: "/$lang/senior", params: { lang } });
				return;
			}

			const data = await res.json();
			setSeniorAccessCode(data.accessCode);
			setStep(2);
		};

		const [resetting, setResetting] = useState(false);

		useImperativeHandle(ref, () => ({
			refresh: () => {
				setStep(1);
				setSeniorAccessCode("");
				setResetting(true);
				setTimeout(() => {
					setResetting(false);
				}, 10);
			},
		}));

		return (
			<div className="flex flex-col items-center flex-grow">
				<div className="w-full flex-grow relative overflow-clip">
					<div
						className="w-full h-full top-0 absolute transition-transform duration-300"
						style={{
							transform: `translateX(-${step * 100}%)`,
							left: "100%",
						}}
					>
						{!resetting && (
							<PersonalInfoForm
								onNextStep={() => {}}
								lang={lang}
								existingEmail={
									session?.user.role === "senior" ? session?.user.email : ""
								}
								submitOnboarding={submitOnboarding}
								loading={seniorLoading}
								onClose={onClose}
							/>
						)}
					</div>

					<div
						className="w-full h-full top-0 absolute transition-transform duration-300"
						style={{
							transform: `translateX(-${step * 100}%)`,
							left: "200%",
						}}
					>
						<div className="flex flex-col items-center justify-between h-full">
							<div />
							<div className="flex flex-col sm:gap-4 items-center overflow-y-auto">
								<div className="flex gap-4 items-center pb-2 sm:pb-8 w-68 sm:w-auto px-8">
									<FaCircleCheck
										size={32}
										className="text-success flex-shrink-0"
									/>
									<h1 className="text-2xl font-bold">
										{t.onboarding.success_adding_senior}
									</h1>
								</div>
								<p className="text-center pb-4 sm:pb-0">
									{t.onboarding.provide_the_code_below}
								</p>
								{seniorAccessCode && (
									<PinInput
										lang={lang}
										pin={seniorAccessCode}
										setPin={() => {}}
										readonly
										clipboardButton
									/>
								)}
							</div>

							<div />

							<div className="pt-4">
								<button type="button" style={DS.btnPrimary} onClick={onClose}>
									{t.common.close}
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	},
);

export default OnboardingForm;
