import { isMatching, P } from "ts-pattern";

const cloudcastsUrl =
	"https://api.mixcloud.com/otherdesertradio/cloudcasts/?limit=100&offset=0";

const pagePattern = {
	data: P.array(P.unknown),
	paging: P.optional({ next: P.optional(P.union(P.string, null)) }),
};

/** Fetch the complete source JSON into request-local memory without writing files. */
export const fetchMixcloud = async (
	fetcher: typeof fetch = fetch,
): Promise<{ data: unknown[] }> => {
	const data: unknown[] = [];
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
		if (!isMatching(pagePattern, page)) {
			throw new Error(`Invalid Mixcloud page -- url: ${url}`);
		}
		data.push(...page.data);
		url = page.paging?.next || undefined;
	}
	return { data };
};
