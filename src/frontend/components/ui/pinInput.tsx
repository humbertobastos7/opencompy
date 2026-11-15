import { useRef, useState, useEffect } from "react";
import { DS } from "@/frontend/designSystem";
import type React from "react";
import { FaRegClipboard } from "react-icons/fa6";
import { dictionary } from "../../assets/i18n";

interface Props {
	pin: string;
	setPin: (pin: string) => void;
	lang: string;
	readonly?: boolean;
	clipboardButton?: boolean;
}

// Pin is in XXXX-XXXX-XXXX format. It should have an input for each character
const PinInput: React.FC<Props> = ({
	pin,
	setPin,
	clipboardButton,
	readonly,
	lang,
}) => {
	const t = dictionary(lang);
	const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
	const [digit0, setDigit0] = useState(pin[0] || "");
	const [digit1, setDigit1] = useState(pin[1] || "");
	const [digit2, setDigit2] = useState(pin[2] || "");
	const [digit3, setDigit3] = useState(pin[3] || "");
	const [digit4, setDigit4] = useState(pin[5] || "");
	const [digit5, setDigit5] = useState(pin[6] || "");
	const [digit6, setDigit6] = useState(pin[7] || "");
	const [digit7, setDigit7] = useState(pin[8] || "");
	const [digit8, setDigit8] = useState(pin[10] || "");
	const [digit9, setDigit9] = useState(pin[11] || "");
	const [digit10, setDigit10] = useState(pin[12] || "");
	const [digit11, setDigit11] = useState(pin[13] || "");

	const [tooltipOpen, setTooltipOpen] = useState(false);

	useEffect(() => {
		const newPin =
			digit0 +
			digit1 +
			digit2 +
			digit3 +
			digit4 +
			digit5 +
			digit6 +
			digit7 +
			digit8 +
			digit9 +
			digit10 +
			digit11;
		if (
			[
				digit0,
				digit1,
				digit2,
				digit3,
				digit4,
				digit5,
				digit6,
				digit7,
				digit8,
				digit9,
				digit10,
				digit11,
			].every((digit) => digit !== "")
		) {
			setPin(newPin);
		} else {
			setPin("");
		}
	}, [
		digit0,
		digit1,
		digit2,
		digit3,
		digit4,
		digit5,
		digit6,
		digit7,
		digit8,
		digit9,
		digit10,
		digit11,
		setPin,
	]);

	const handleKeyDown = (
		index: number,
		event: React.KeyboardEvent<HTMLInputElement>,
	) => {
		const value = event.key;
		if (event.ctrlKey && value.toLowerCase() === "v") {
			return;
		}
		if (/^[a-zA-Z0-9]$/.test(value) && !(index === 11 && digit11 !== "")) {
			switch (index) {
				case 0:
					setDigit0(value);
					break;
				case 1:
					setDigit1(value);
					break;
				case 2:
					setDigit2(value);
					break;
				case 3:
					setDigit3(value);
					break;
				case 4:
					setDigit4(value);
					break;
				case 5:
					setDigit5(value);
					break;
				case 6:
					setDigit6(value);
					break;
				case 7:
					setDigit7(value);
					break;
				case 8:
					setDigit8(value);
					break;
				case 9:
					setDigit9(value);
					break;
				case 10:
					setDigit10(value);
					break;
				case 11:
					setDigit11(value);
					break;
			}
			if (index < inputsRef.current.length - 1) {
				inputsRef.current[index + 1]?.focus();
			}
		} else if (event.key === "Backspace") {
			if (
				index > 0 &&
				![
					digit0,
					digit1,
					digit2,
					digit3,
					digit4,
					digit5,
					digit6,
					digit7,
					digit8,
					digit9,
					digit10,
					digit11,
				][index]
			) {
				inputsRef.current[index - 1]?.focus();
			} else {
				switch (index) {
					case 0:
						setDigit0("");
						break;
					case 1:
						setDigit1("");
						break;
					case 2:
						setDigit2("");
						break;
					case 3:
						setDigit3("");
						break;
					case 4:
						setDigit4("");
						break;
					case 5:
						setDigit5("");
						break;
					case 6:
						setDigit6("");
						break;
					case 7:
						setDigit7("");
						break;
					case 8:
						setDigit8("");
						break;
					case 9:
						setDigit9("");
						break;
					case 10:
						setDigit10("");
						break;
					case 11:
						setDigit11("");
						break;
				}
			}
		}
	};

	const handlePaste = (
		index: number,
		event: React.ClipboardEvent<HTMLInputElement>,
	) => {
		event.preventDefault();
		const paste = event.clipboardData.getData("text").replace(/-/g, "");
		const chars = paste.split("").slice(0, 12 - index);
		chars.forEach((char, i) => {
			if (/^[a-zA-Z0-9]$/.test(char)) {
				switch (index + i) {
					case 0:
						setDigit0(char);
						break;
					case 1:
						setDigit1(char);
						break;
					case 2:
						setDigit2(char);
						break;
					case 3:
						setDigit3(char);
						break;
					case 4:
						setDigit4(char);
						break;
					case 5:
						setDigit5(char);
						break;
					case 6:
						setDigit6(char);
						break;
					case 7:
						setDigit7(char);
						break;
					case 8:
						setDigit8(char);
						break;
					case 9:
						setDigit9(char);
						break;
					case 10:
						setDigit10(char);
						break;
					case 11:
						setDigit11(char);
						break;
				}
				if (index + i < inputsRef.current.length - 1) {
					inputsRef.current[index + i + 1]?.focus();
				}
			}
		});
	};

	const copyToClipboard = () => {
		navigator.clipboard.writeText(pin);
		setTooltipOpen(true);
		setTimeout(() => setTooltipOpen(false), 2000);
	};

	useEffect(() => {
		if (readonly) {
			setDigit0(pin[0] || "");
			setDigit1(pin[1] || "");
			setDigit2(pin[2] || "");
			setDigit3(pin[3] || "");
			setDigit4(pin[5] || "");
			setDigit5(pin[6] || "");
			setDigit6(pin[7] || "");
			setDigit7(pin[8] || "");
			setDigit8(pin[10] || "");
			setDigit9(pin[11] || "");
			setDigit10(pin[12] || "");
			setDigit11(pin[13] || "");
		}
	}, [pin, readonly]);

	return (
		<div className="flex sm:gap-2 items-center flex-col sm:flex-row">
			<div className="flex gap-2">
				{[0, 1, 2, 3].map((i) => (
					<input
						key={i}
						type="text"
						maxLength={1}
						className="input input-sm sm:input-md w-8 text-center hide-spinner font-mono"
						style={{
							backgroundColor: DS.C.white,
							border: `1px solid rgba(26,95,90,0.25)`,
							borderRadius: DS.radius.sm,
							color: DS.C.text,
							padding: 0,
							transition: DS.transition.fast,
						}}
						value={[digit0, digit1, digit2, digit3][i]}
						onKeyDown={(e) => handleKeyDown(i, e)}
						onPaste={(e) => handlePaste(i, e)}
						ref={(el) => {
							inputsRef.current[i] = el;
						}}
						readOnly={readonly}
					/>
				))}
			</div>
			<p>-</p>
			<div className="flex gap-2">
				{[4, 5, 6, 7].map((i) => (
					<input
						key={i}
						type="text"
						maxLength={1}
						className="input input-sm sm:input-md w-8 text-center hide-spinner font-mono"
						style={{
							backgroundColor: DS.C.white,
							border: `1px solid rgba(26,95,90,0.25)`,
							borderRadius: DS.radius.sm,
							color: DS.C.text,
							padding: 0,
							transition: DS.transition.fast,
						}}
						value={[digit4, digit5, digit6, digit7][i - 4]}
						onKeyDown={(e) => handleKeyDown(i, e)}
						onPaste={(e) => handlePaste(i, e)}
						ref={(el) => {
							inputsRef.current[i] = el;
						}}
						readOnly={readonly}
					/>
				))}
			</div>
			<p>-</p>
			<div className="flex gap-2">
				{[8, 9, 10, 11].map((i) => (
					<input
						key={i}
						type="text"
						maxLength={1}
						className="input input-sm sm:input-md w-8 text-center hide-spinner font-mono"
						style={{
							backgroundColor: DS.C.white,
							border: `1px solid rgba(26,95,90,0.25)`,
							borderRadius: DS.radius.sm,
							color: DS.C.text,
							padding: 0,
							transition: DS.transition.fast,
						}}
						value={[digit8, digit9, digit10, digit11][i - 8]}
						onKeyDown={(e) => handleKeyDown(i, e)}
						onPaste={(e) => handlePaste(i, e)}
						ref={(el) => {
							inputsRef.current[i] = el;
						}}
						readOnly={readonly}
					/>
				))}
			</div>
			{clipboardButton && (
				<div
					className={
						tooltipOpen
							? "tooltip tooltip-open w-full sm:w-auto mt-8 sm:mt-0"
							: "w-full sm:w-auto mt-8 sm:mt-0"
					}
					data-tip={t.common.copied}
				>
					<button
						type="button"
						onClick={copyToClipboard}
						style={{ ...DS.btnPrimary, width: "100%" }}
						disabled={!pin}
					>
						<FaRegClipboard className="w-6 h-6" />
						<span className="sm:hidden">{t.common.copy}</span>
					</button>
				</div>
			)}
		</div>
	);
};

export default PinInput;
