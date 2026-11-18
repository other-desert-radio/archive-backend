import { P } from "ts-pattern";
import type { AdminApiReply, ErrorResponse } from "../types.js";
export type Special = { id: number; title: string; createdAt: string };
export type CreateSpecialRequest = { title: string };
export type ModifySpecialRequest = { id: number; title: string };
export type ModifySpecialRoute = { Reply: AdminApiReply<Special> };
export type ListSpecialsRoute = { Reply: AdminApiReply<Special[]> };
export type CreateSpecialRoute = { Reply: AdminApiReply<Special> };
export const RemoveSpecialRequestPattern = {
	id: P.number.int().between(1, Number.MAX_SAFE_INTEGER),
} as const;
export type RemoveSpecialRequest = P.infer<typeof RemoveSpecialRequestPattern>;
export type RemoveSpecialResponse = { id: number };
export type RemoveSpecialRoute = {
	Body: RemoveSpecialRequest;
	Reply: AdminApiReply<RemoveSpecialResponse> & { 409: ErrorResponse };
};
export type SpecialDeleteImpact = {
	special: { id: number; title: string };
	shows: { id: number; title: string }[];
};
export type GetSpecialDeleteImpactRoute = {
	Params: { id: string };
	Reply: AdminApiReply<SpecialDeleteImpact>;
};
