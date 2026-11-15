import { ScrollShadow } from "@nextui-org/scroll-shadow";
import { dictionary } from "../../assets/i18n";

interface Props {
	onNextStep?: () => void;
	onPreviousStep?: () => void;
	lang: string;
}

export const ResidencyForm: React.FC<Props> = ({
	onNextStep,
	onPreviousStep,
	lang,
}) => {
	const t = dictionary(lang);
	return (
		<div className="w-full h-full flex flex-col justify-between items-center p-4">
			<ScrollShadow
				size={64}
				className="w-full flex-grow flex flex-col overflow-y-auto overflow-x-clip items-center gap-2 pb-20"
			>
				<label className="form-control w-full max-w-xs">
					<div className="label">
						<span className="label-text">{t.onboarding.designation}*</span>
					</div>
					<input type="text" className="input input-bordered w-full max-w-xs" />
				</label>

				<label className="form-control w-full max-w-xs">
					<div className="label">
						<span className="label-text">{t.onboarding.address_line_1}*</span>
					</div>
					<input type="text" className="input input-bordered w-full max-w-xs" />
				</label>

				<label className="form-control w-full max-w-xs">
					<div className="label">
						<span className="label-text">{t.onboarding.address_line_2}</span>
					</div>
					<input type="text" className="input input-bordered w-full max-w-xs" />
				</label>

				<label className="form-control w-full max-w-xs">
					<div className="label">
						<span className="label-text">{t.onboarding.postal_code}*</span>
					</div>
					<input type="text" className="input input-bordered w-full max-w-xs" />
				</label>

				<label className="form-control w-full max-w-xs">
					<div className="label">
						<span className="label-text">{t.onboarding.locality}*</span>
					</div>
					<input type="text" className="input input-bordered w-full max-w-xs" />
				</label>
			</ScrollShadow>

			<div className="flex w-full max-w-screen-sm gap-4">
				<button
					type="button"
					className="btn btn-ghost flex-1"
					onClick={onPreviousStep}
					disabled={!onPreviousStep}
				>
					{t.common.back}
				</button>
				<button
					type="button"
					className="btn btn-primary flex-1"
					onClick={onNextStep}
					disabled={!onNextStep}
				>
					{t.common.continue}
				</button>
			</div>
		</div>
	);
};
