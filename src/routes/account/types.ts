export type ChangePasswordRoute = {
	Body: unknown;
	Reply: {
		200: { success: boolean };
		400: { error: string };
		401: { error: string };
		403: { error: string };
		429: { error: string };
		500: { error: string };
	};
};
