import { isMatching, P } from "ts-pattern";

const cloudcastsUrl =
	"https://api.mixcloud.com/otherdesertradio/cloudcasts/?limit=100&offset=0";

// unused fields are commented out for performance but left here for documentation
const PicturesPattern = {
	small: P.string,
	//thumbnail: P.string,
	//medium_mobile: P.string,
	//medium: P.string,
	large: P.string,
	//"320wx320h": P.string,
	//extra_large: P.string,
	//"640wx640h": P.string,
} as const;

// unused fields are commented out for performance but left here for documentation
const CloudcastPattern = {
	key: P.string,
	url: P.string,
	name: P.string,
	tags: P.array({ key: P.string, url: P.string, name: P.string }),
	created_time: P.string,
	updated_time: P.string,
	play_count: P.number,
	//favorite_count: P.number,
	//comment_count: P.number,
	//listener_count: P.number,
	//repost_count: P.number,
	pictures: {
		...PicturesPattern,
		//"768wx768h": P.string,
		//"1024wx1024h": P.string,
	},
	slug: P.string,
	//user: {
	//  key: P.string,
	//  url: P.string,
	//  name: P.string,
	//  username: P.string,
	//  pictures: PicturesPattern,
	//},
	//hosts: P.array(P.unknown),
	audio_length: P.number,
} as const;

const PagePattern = {
	data: P.array(CloudcastPattern),
	paging: P.optional({ next: P.optional(P.union(P.string, null)) }),
} as const;

/** Fetch the complete source JSON into request-local memory without writing files. */
export const fetchMixcloud = async (
	fetcher: typeof fetch = fetch,
): Promise<{ data: P.infer<typeof PagePattern>["data"] }> => {
	const data: P.infer<typeof PagePattern>["data"] = [];
	let url: string | undefined = cloudcastsUrl;
	const visited = new Set<string>();
	while (url) {
		if (visited.has(url)) throw new Error("Repeated Mixcloud pagination URL");
		visited.add(url);
		const response = await fetcher(url, {
			signal: AbortSignal.timeout(30_000),
		});
		if (!response.ok) {
			throw new Error(
				`Mixcloud request failed -- status: ${response.status}, url: ${url}`,
			);
		}
		const page: unknown = await response.json();
		if (!isMatching(PagePattern, page)) {
			throw new Error(`Invalid Mixcloud page -- url: ${url}`);
		}
		data.push(...page.data);
		url = page.paging?.next || undefined;
	}
	return { data };
};
