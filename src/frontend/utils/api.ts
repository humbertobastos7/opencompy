import { VISIT_KEY, VISIT_KEY_HEADER } from "./visit";

type ParamValue = string | number | null | undefined;
type RequestArgs = {
	json?: unknown;
	param?: Record<string, ParamValue>;
	headers?: HeadersInit;
	signal?: AbortSignal;
};

const createRequester = (baseUrl: URL) => {
	const request =
		(method: string, path: string) =>
		async (args: RequestArgs = {}) => {
			const headers = new Headers(args.headers);
			headers.set(VISIT_KEY_HEADER, VISIT_KEY);

			if (args.json !== undefined) {
				headers.set("Content-Type", "application/json");
			}

			const resolvedPath = path.replace(/:([A-Za-z0-9_]+)/g, (_match, key) => {
				const value = args.param?.[key];
				return encodeURIComponent(value == null ? "" : String(value));
			});

			return fetch(new URL(resolvedPath, baseUrl), {
				method,
				headers,
				signal: args.signal,
				body: args.json !== undefined ? JSON.stringify(args.json) : undefined,
			});
		};

	return {
		me: {
			$get: request("GET", "me"),
		},
		admin: {
			dashboard: {
				$get: request("GET", "admin/dashboard"),
			},
			institutions: {
				$get: request("GET", "admin/institutions"),
				$post: request("POST", "admin/institutions"),
				":institutionId": {
					$get: request("GET", "admin/institutions/:institutionId"),
					$patch: request("PATCH", "admin/institutions/:institutionId"),
					$delete: request("DELETE", "admin/institutions/:institutionId"),
				},
			},
			caregivers: {
				$get: request("GET", "admin/caregivers"),
				$post: request("POST", "admin/caregivers"),
				":caregiverId": {
					$get: request("GET", "admin/caregivers/:caregiverId"),
					$patch: request("PATCH", "admin/caregivers/:caregiverId"),
					$delete: request("DELETE", "admin/caregivers/:caregiverId"),
					institution: {
						$patch: request(
							"PATCH",
							"admin/caregivers/:caregiverId/institution",
						),
					},
				},
			},
			seniors: {
				$get: request("GET", "admin/seniors"),
				$post: request("POST", "admin/seniors"),
				":seniorId": {
					$get: request("GET", "admin/seniors/:seniorId"),
					$patch: request("PATCH", "admin/seniors/:seniorId"),
					$delete: request("DELETE", "admin/seniors/:seniorId"),
					institution: {
						$patch: request("PATCH", "admin/seniors/:seniorId/institution"),
					},
					"regenerate-access-code": {
						$post: request(
							"POST",
							"admin/seniors/:seniorId/regenerate-access-code",
						),
					},
				},
			},
			plans: {
				$get: request("GET", "admin/plans"),
				$post: request("POST", "admin/plans"),
				":planId": {
					$patch: request("PATCH", "admin/plans/:planId"),
					$delete: request("DELETE", "admin/plans/:planId"),
				},
			},
		},
		caregiver: {
			institution: {
				$get: request("GET", "caregiver/institution"),
			},
			profile: {
				$patch: request("PATCH", "caregiver/profile"),
			},
			dashboard: {
				$get: request("GET", "caregiver/dashboard"),
			},
			"daily-overview": {
				$get: request("GET", "caregiver/daily-overview"),
			},
			"elevenlabs-quota": {
				$get: request("GET", "caregiver/elevenlabs-quota"),
			},
			seniors: {
				$post: request("POST", "caregiver/seniors"),
				":seniorId": {
					summary: {
						$get: request("GET", "caregiver/seniors/:seniorId/summary"),
					},
					conversations: {
						count: {
							$get: request(
								"GET",
								"caregiver/seniors/:seniorId/conversations/count",
							),
						},
					},
					activity: {
						$get: request("GET", "caregiver/seniors/:seniorId/activity"),
					},
					notes: {
						$get: request("GET", "caregiver/seniors/:seniorId/notes"),
						$post: request("POST", "caregiver/seniors/:seniorId/notes"),
						":noteId": {
							$patch: request(
								"PATCH",
								"caregiver/seniors/:seniorId/notes/:noteId",
							),
							$delete: request(
								"DELETE",
								"caregiver/seniors/:seniorId/notes/:noteId",
							),
						},
					},
				},
			},
		},
		onboarding: {
			$post: request("POST", "onboarding"),
			assign: {
				$post: request("POST", "onboarding/assign"),
			},
			"approve-location": {
				$post: request("POST", "onboarding/approve-location"),
			},
			status: {
				$get: request("GET", "onboarding/status"),
			},
			complete: {
				$post: request("POST", "onboarding/complete"),
			},
		},
		chat: {
			voice: {
				session: {
					$post: request("POST", "chat/voice/session"),
				},
				turn: {
					$post: request("POST", "chat/voice/turn"),
				},
				tts: {
					$post: request("POST", "chat/voice/tts"),
				},
				close: {
					$post: request("POST", "chat/voice/close"),
				},
			},
			"session-log": {
				$post: request("POST", "chat/session-log"),
			},
		},
		seniors: {
			$get: request("GET", "seniors"),
			"available-dates": {
				$get: request("GET", "seniors/available-dates"),
			},
			":seniorId": {
				$get: request("GET", "seniors/:seniorId"),
				conversations: {
					$post: request("POST", "seniors/:seniorId/conversations"),
				},
				likes: {
					$patch: request("PATCH", "seniors/:seniorId/likes"),
				},
				nickname: {
					$patch: request("PATCH", "seniors/:seniorId/nickname"),
				},
				profile: {
					$patch: request("PATCH", "seniors/:seniorId/profile"),
				},
				"senior-settings": {
					$get: request("GET", "seniors/:seniorId/senior-settings"),
					$patch: request("PATCH", "seniors/:seniorId/senior-settings"),
				},
				"emotional-trend": {
					$get: request("GET", "seniors/:seniorId/emotional-trend"),
				},
				report: {
					":date": {
						$get: request("GET", "seniors/:seniorId/report/:date"),
					},
				},
			},
		},
	};
};

export const create_api_client = (url: URL) => createRequester(url);
export type ApiClient = ReturnType<typeof create_api_client>;

export const api_client: ApiClient = create_api_client(
	new URL("/api/", window.location.href),
);
