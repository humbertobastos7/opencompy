import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSessionStore } from "@/frontend/stores/session";
import { validateUserSession } from "@/frontend/stores/session";
import { usePageBackgroundStore } from "@/frontend/stores/pageBackground";
import { api_client } from "@/frontend/utils/api";
import { IntroSlides } from "./IntroSlides";
import { OnboardingQuestions } from "./OnboardingQuestions";
import { SmokeBackground } from "./SmokeBackground";
import type { OnboardingAnswers } from "./OnboardingQuestions";

const mapLivingToFamily = (livingWith: string, gender?: "m" | "f" | null) => {
	if (livingWith === "sozinho") return gender === "f" ? "sozinha" : "sozinho";
	if (livingWith === "familia") return "família";
	if (livingWith === "lar") return "lar";
	return livingWith;
};

function mapHobbiesToLikes(hobbies: string[]) {
	const freeForm = hobbies.filter((h) =>
		["jardim", "leitura", "familia", "jogos"].includes(h),
	);
	return {
		football: hobbies.includes("desporto") ? ["desporto_geral"] : [],
		music: hobbies.includes("musica") ? ["musica_geral"] : [],
		cinema: hobbies.includes("televisao") ? ["televisao"] : [],
		gastronomy: hobbies.includes("cozinha") ? ["culinaria"] : [],
		hobbies: freeForm,
		others: {},
	};
}

interface Props {
	lang: string;
}

export const SeniorWelcomeFlow: React.FC<Props> = ({ lang }) => {
	const [phase, setPhase] = useState<"intro" | "questions">("intro");
	const { session } = useSessionStore();
	const navigate = useNavigate();
	const setHideFooter = usePageBackgroundStore((s) => s.setHideFooter);
	const setBackground = usePageBackgroundStore((s) => s.setBackground);
	const shouldReduceMotion = useReducedMotion();

	useEffect(() => {
		setHideFooter(true);
		// More vivid yellow + cyan gradient for the welcome page
		setBackground(
			"radial-gradient(circle at 12% 24%, rgba(255,224,40,0.92) 0%, rgba(255,224,40,0.60) 24%, rgba(255,224,40,0.18) 42%, rgba(255,224,40,0) 58%), " +
				"radial-gradient(circle at 92% 80%, rgba(13,207,180,0.82) 0%, rgba(13,207,180,0.50) 18%, rgba(13,207,180,0.16) 36%, rgba(13,207,180,0) 54%), " +
				"linear-gradient(135deg, #ffe838 0%, #f0fff8 50%, #0dcfb8 100%)",
		);
		return () => {
			setHideFooter(false);
			setBackground(null);
		};
	}, [setHideFooter, setBackground]);

	const [saving, setSaving] = useState(false);

	const firstName = session?.user.name?.split(" ")[0] || "Amigo";
	const initialNickname =
		session?.user.nickname || session?.user.name?.split(" ")[0] || "";

	const handleComplete = async (answers: OnboardingAnswers) => {
		const seniorId = session?.user.id;
		if (!seniorId) return;
		setSaving(true);
		try {
			const profilePatch = {
				...(answers.livingWith
					? {
							family: mapLivingToFamily(
								answers.livingWith,
								session?.user.gender ?? null,
							),
						}
					: {}),
				...(answers.context?.trim()
					? { initialContext: answers.context.trim() }
					: {}),
			};
			await Promise.allSettled([
				api_client.seniors[":seniorId"].nickname.$patch({
					json: { nickname: answers.nickname },
					param: { seniorId },
				}),
				Object.keys(profilePatch).length > 0
					? api_client.seniors[":seniorId"].profile.$patch({
							json: profilePatch,
							param: { seniorId },
						})
					: Promise.resolve(),
				api_client.seniors[":seniorId"].likes.$patch({
					json: { likes: mapHobbiesToLikes(answers.hobbies) },
					param: { seniorId },
				}),
			]);
			await api_client.onboarding.complete.$post({});
			await validateUserSession(true);
		} finally {
			setSaving(false);
		}
		navigate({ to: "/$lang/senior", params: { lang } });
	};

	return (
		<div
			style={{
				height: "100%",
				width: "100%",
				display: "flex",
				flexDirection: "column",
				paddingTop: "var(--sat, 0px)",
			}}
		>
			<AnimatePresence mode="wait">
				{phase === "intro" ? (
					<motion.div
						key="intro"
						initial={shouldReduceMotion ? false : { opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
						style={{
							flex: 1,
							display: "flex",
							flexDirection: "column",
							position: "relative",
						}}
					>
						{!shouldReduceMotion && (
							<SmokeBackground smokeColor="#0dcfcf" opacity={0.48} />
						)}
						<IntroSlides
							firstName={firstName}
							gender={session?.user.gender ?? null}
							onComplete={() => setPhase("questions")}
						/>
					</motion.div>
				) : (
					<motion.div
						key="questions"
						initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0 }}
						transition={{
							type: "spring",
							duration: 0.5,
							bounce: 0,
						}}
						style={{ flex: 1, display: "flex", flexDirection: "column" }}
					>
						<OnboardingQuestions
							initialNickname={initialNickname}
							gender={session?.user.gender ?? null}
							birthDate={session?.user.birthDate ?? null}
							onComplete={handleComplete}
							submitting={saving}
						/>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};
