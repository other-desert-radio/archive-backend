import type { ErrorResponse } from "../types.js";
export type AdminUiRoute = {
	Params: { "*"?: string };
	Reply: {
		200: Buffer;
		404: ErrorResponse;
		503: ErrorResponse;
	};
};
