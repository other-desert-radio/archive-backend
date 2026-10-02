import { isMatching } from "ts-pattern";
import { type MixcloudCloudcasts, PagePattern } from "./types.js";

const cloudcastsUrl =
	"https://api.mixcloud.com/otherdesertradio/cloudcasts/?limit=100&offset=0";

/** Fetch the complete source JSON into request-local memory without writing files. */
export const fetchMixcloud = async (
	fetcher: typeof fetch = fetch,
	logger?: FastifyBaseLogger,
): Promise<MixcloudCloudcasts> => {
	const data: MixcloudCloudcasts["data"] = [];
	let url: string | undefined = cloudcastsUrl;
	const visited = new Set<string>();
	while (url) {
		const pageNumber = visited.size + 1;
		const startedAt = Date.now();
		logger?.info(
			{ page: pageNumber, url },
			`[Mixcloud Refresh] fetching page ${pageNumber} -- url: ${url}`,
		);
		if (visited.has(url)) throw new Error("Repeated Mixcloud pagination URL");
		visited.add(url);
		const response = await fetcher(url, {
			signal: AbortSignal.timeout(30_000),
		});
		logger?.info(
			{
				page: pageNumber,
				url,
				status: response.status,
				elapsedMs: Date.now() - startedAt,
			},
			`[Mixcloud Refresh] page ${pageNumber} response -- status: ${response.status}, elapsed: ${Date.now() - startedAt}ms, url: ${url}`,
		);
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
		logger?.info(
			{
				page: pageNumber,
				count: page.data.length,
				total: data.length,
				next: url,
			},
			`[Mixcloud Refresh] page ${pageNumber} validated -- records: ${page.data.length}, total: ${data.length}, next: ${url ?? "none"}`,
		);
	}
	return { data };
};

import type { FastifyBaseLogger } from "fastify";
