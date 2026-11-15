import { useRef, useState } from "react";
import { DS } from "@/frontend/designSystem";
import { dictionary } from "../../assets/i18n";
import { IoMenu } from "react-icons/io5";

import { TbBubbleText } from "react-icons/tb";
import { useSessionStore } from "../../stores/session";
import ChangeNicknameDialog from "../seniors/changeNicknameDialog";
import { HiMiniUserCircle, HiUserPlus } from "react-icons/hi2";
import { useRouter } from "@tanstack/react-router";
import AddSeniorModal from "../seniors/addSeniorModal";

export const Settings = ({
	locale,
	btnClassName,
}: { locale: string; btnClassName?: string }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [snapshotRole, setSnapshotRole] = useState<string | undefined>(
		undefined,
	);
	const t = dictionary(locale);
	const { session } = useSessionStore();
	const router = useRouter();

	const changeNickDialogRef = useRef<HTMLDialogElement | null>(null);
	const addSeniorDialogRef = useRef<HTMLDialogElement | null>(null);
	const dropdownRef = useRef<HTMLDivElement | null>(null);

	return (
		<>
			<div
				className={`dropdown dropdown-bottom dropdown-end ${isOpen ? "group" : ""}`}
				ref={dropdownRef}
			>
				<button
					tabIndex={0}
					type="button"
					className={
						btnClassName
							? btnClassName
							: "btn btn-square btn-ghost group-focus-within:btn-disabled text-accent"
					}
					onClick={() => {
						if (!isOpen) setSnapshotRole(session?.user.role);
						setIsOpen(!isOpen);
					}}
					onBlur={(e) => {
						console.log("blurring");
						if (dropdownRef.current?.contains(e.relatedTarget as Node)) {
							console.log("ignoring blur");
							return;
						}
						setTimeout(() => setIsOpen(false), 500);
					}}
				>
					<IoMenu className="h-6 w-6" />
				</button>
				{isOpen && (
					<ul
						// biome-ignore lint/a11y/noNoninteractiveTabindex: I need it to work with dausyUI
						tabIndex={0}
						className="dropdown-content menu menu-md sm:menu-lg z-50 w-60 sm:w-72 text-black [&_a]:text-black [&_a]:text-sm sm:[&_a]:text-base"
						style={{ ...DS.glassCard, padding: 8, color: "#111111" }}
					>
						{session?.user.role === "senior" && (
							// biome-ignore lint/a11y/useKeyWithClickEvents: the li is the link
							<li
								onClick={() => {
									changeNickDialogRef.current?.showModal();
									setTimeout(() => setIsOpen(false), 500);
								}}
							>
								{/* biome-ignore lint/a11y/useValidAnchor: This is react, I don't need the href, there's an onclick on the li */}
								<a className="gap-4">
									<TbBubbleText size={18} />
									{t.onboarding.nickname}
								</a>
							</li>
						)}
						{snapshotRole === "caregiver" && (
							// biome-ignore lint/a11y/useKeyWithClickEvents: the li is the link
							<li
								onClick={() => {
									void router.navigate({
										to: "/$lang/caretaker/profile",
										params: { lang: locale },
									});
									setTimeout(() => setIsOpen(false), 300);
								}}
							>
								{/* biome-ignore lint/a11y/useValidAnchor: This is react, I don't need the href, there's an onclick on the li */}
								<a className="gap-4">
									<HiMiniUserCircle size={18} />O meu perfil
								</a>
							</li>
						)}
						{snapshotRole === "caregiver" && (
							// biome-ignore lint/a11y/useKeyWithClickEvents: the li is the link
							<li
								onClick={() => {
									addSeniorDialogRef.current?.showModal();
									setTimeout(() => setIsOpen(false), 300);
								}}
							>
								{/* biome-ignore lint/a11y/useValidAnchor: This is react, I don't need the href, there's an onclick on the li */}
								<a className="gap-4">
									<HiUserPlus size={18} />
									Adicionar sénior
								</a>
							</li>
						)}
					</ul>
				)}
			</div>
			<ChangeNicknameDialog lang={locale} dialogRef={changeNickDialogRef} />
			<AddSeniorModal lang={locale} dialogRef={addSeniorDialogRef} />
		</>
	);
};
