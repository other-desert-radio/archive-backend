import { P } from "ts-pattern";
import { isHttpUrl } from "../utils/index.js";
import {
	createdTimeRegex,
	parseCreatedTimeDate,
} from "../utils/mixcloud-parser/index.js";

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

export type MixcloudPictures = P.infer<typeof PicturesPattern>;
export type MixcloudCloudcast = P.infer<typeof CloudcastPattern>;

/** Metadata required to create an archive Show from a newly uploaded cloudcast. */
export const UploadedCloudcastPattern = {
	...CloudcastPattern,
	key: P.string.regex(/^\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/$/),
	url: P.string.and(
		P.when((value) => typeof value === "string" && isHttpUrl(value)),
	),
	audio_length: P.number.int().between(1, 2_147_483_647),
	pictures: {
		large: P.string.and(
			P.when((value) => typeof value === "string" && isHttpUrl(value)),
		),
		"1024wx1024h": P.string.and(
			P.when((value) => typeof value === "string" && isHttpUrl(value)),
		),
	},
	tags: P.array({
		key: P.string,
		url: P.string.and(
			P.when((value) => typeof value === "string" && isHttpUrl(value)),
		),
		name: P.string.and(
			P.when((value) => typeof value === "string" && value.trim().length > 0),
		),
	}),
} as const;
