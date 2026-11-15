import "react-toastify/dist/ReactToastify.css";
import { ToastContainer, cssTransition } from "react-toastify";

const CompyToastTransition = cssTransition({
	enter: "compy-toast-enter",
	exit: "compy-toast-exit",
	collapseDuration: 180,
});

export const CompyToastContainer: React.FC = () => (
	<ToastContainer
		position="top-right"
		autoClose={3400}
		hideProgressBar
		newestOnTop
		closeOnClick={false}
		draggable={false}
		pauseOnHover
		pauseOnFocusLoss={false}
		limit={4}
		theme="light"
		icon={false}
		transition={CompyToastTransition}
		toastClassName={(context) =>
			`compy-toast compy-toast--${context?.type ?? "default"}`
		}
	/>
);
