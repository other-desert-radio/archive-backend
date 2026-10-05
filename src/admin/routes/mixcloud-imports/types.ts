import { P } from "ts-pattern";
import {
	createdTimeRegex,
	parseCreatedTimeDate,
} from "../../../utils/mixcloud-parser/index.js";

// unused fields are commented out for performance but left here for documentation
export const PicturesPattern = {
	large: P.string,
	"1024wx1024h": P.string,
	//small: P.string,
	//thumbnail: P.string,
	//medium_mobile: P.string,
	//medium: P.string,
	//"320wx320h": P.string,
	//extra_large: P.string,
	//"640wx640h": P.string,
} as const;

// unused fields are commented out for performance but left here for documentation
export const CloudcastPattern = {
	key: P.string,
	url: P.string,
	name: P.string,
	tags: P.array({ key: P.string, url: P.string, name: P.string }),
	// Format examples: "2020-04-07T12:00:00Z", "2020-04-07T01:30:00.123+02:00".
	created_time: P.string
		.regex(createdTimeRegex)
		.and(
			P.when(
				(value) =>
					typeof value === "string" &&
					parseCreatedTimeDate(value) !== undefined,
			),
		),
	updated_time: P.string,
	play_count: P.number,
	pictures: {
		...PicturesPattern,
		//"768wx768h": P.string,
	},
	slug: P.string,
	audio_length: P.number,
	//favorite_count: P.number,
	//comment_count: P.number,
	//listener_count: P.number,
	//repost_count: P.number,
	//user: {
	//  key: P.string,
	//  url: P.string,
	//  name: P.string,
	//  username: P.string,
	//  pictures: PicturesPattern,
	//},
	//hosts: P.array(P.unknown),
} as const;

export const PagePattern = {
	data: P.array(CloudcastPattern),
	paging: P.optional({ next: P.optional(P.union(P.string, null)) }),
} as const;

export type MixcloudPictures = P.infer<typeof PicturesPattern>;
export type MixcloudCloudcast = P.infer<typeof CloudcastPattern>;
export type MixcloudPage = P.infer<typeof PagePattern>;
export type MixcloudCloudcasts = Pick<MixcloudPage, "data">;

/** JSON contract for the authenticated, read-only Mixcloud import list. */
export type MixcloudImportAdminRow = {
	data_changed: boolean;
	id: number;
	key: string;
	url?: string;
	name?: string;
	created_time?: string;
	derived_title?: string;
	derived_date?: string;
	decoded_djs_exist?: boolean;
	decoded_djs?: string[];
	parser_version?: number;
	parser_key?: string;
	date_source?: "title" | "created_time";
	image_small?: string;
	image_large?: string;
	show_id?: number;
	imported_at?: string;
	show_name?: string;
	djs: number[];
	dj_names: string[];
	mixcloud_tags?: { key: string; name: string; url?: string }[];
	duration?: number;
	tags: number[];
};
/** Temporary response contract for the Mixcloud refresh scaffold. */
export type RefreshMixcloudResponse = { status: "ok" };

/** Counts of pending source rows by import readiness. */
export type MixcloudImportStatus = { auto_parsed: number; unparsable: number };
