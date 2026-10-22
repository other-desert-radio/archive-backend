import { fileURLToPath } from "node:url";
import type { Kysely } from "kysely";
import type { ArchiveDocuments } from "../db/export-archive.js";
import type { Database } from "../db/types.js";
import { validatePublicationDestination } from "./checkout.js";
import {
	fetchPublicationBranch,
	generatedPath,
	inspectGit,
	type PublicationGitContext,
	type PublicationRecovery,
	pathsFromGit,
	readGitBytes,
	reconcilePublicationGit,
	validatePublicationCheckout,
} from "./git/index.js";
import {
	readLocalPublicationFiles,
	snapshotLocalPublicationFiles,
} from "./local-preview.js";
import {
	comparePublicationArchives,
	documentsPublicationArchive,
	type PublicationArchive,
	readPublicationArchive,
} from "./preview-diff.js";
import { readPublicationSnapshot } from "./snapshot.js";
import {
	acquirePublicationLease,
	PublicationBusyError,
	type PublicationLease,
	PublicationRequestError,
	readPublicationJobRecord,
	readPublicationStatus,
} from "./store.js";
import { readPublicationTarget, samePublicationTarget } from "./target.js";
import type {
	PublicationConfig,
	PublicationJob,
	PublicationPreview,
	PublicationStart,
	PublicationTarget,
} from "./types.js";

export type PreparedPublication = {
	preview: PublicationPreview;
	requestedBy: string;
	retryJobId?: string | undefined;
	target: PublicationTarget;
	documents?: ArchiveDocuments;
	baseline?: { commit: string; missing: boolean };
	localFingerprint?: string;
	recovery: PublicationRecovery;
	sourceRevision: string;
	inUse: boolean;
};

/** Read generated files directly from a trusted commit; no worktree or temporary files. */
const readCommitArchive = async (checkout: string, commit: string) => {
	const files = new Set<string>();
	for (const entry of pathsFromGit(
		await inspectGit(checkout, [
			"ls-tree",
			"-r",
			"-z",
			commit,
			"--",
			"src/res/djs",
			"src/res/djs_brief.json",
			"src/res/shows.json",
			"src/res/tags.json",
			"public/assets/djs",
		]),
	)) {
		const separator = entry.indexOf("\t");
		const file = entry.slice(separator + 1);
		if (
			separator < 0 ||
			!/^100(644|755) blob [0-9a-f]+$/.test(entry.slice(0, separator)) ||
			!generatedPath(file) ||
			file
				.split("/")
				.some((part) => part === ".." || part === "." || part === "")
		)
			throw new Error("Unsupported generated file in publication branch");
		files.add(file);
	}
	let totalBytes = 0;
	return readPublicationArchive(
		async (file) => {
			if (!files.has(file)) return undefined;
			const bytes = await readGitBytes({
				checkout,
				args: ["show", `${commit}:${file}`],
				operation: "read publication baseline",
			});
			totalBytes += bytes.length;
			if (totalBytes > 256 * 1024 * 1024)
				throw new Error("Publication preview exceeds the 256 MB limit");
			return bytes;
		},
		async () =>
			[...files]
				.filter((file) => /^src\/res\/djs\/[^/]+\.json$/.test(file))
				.map((file) => file.slice("src/res/djs/".length)),
	);
};

export const createPublicationPreviews = (
	database: Kysely<Database>,
	config: PublicationConfig,
) => {
	const entries = new Map<string, PreparedPublication>();
	const preparations = new Map<string, Promise<PublicationPreview>>();
	let closing = false;
	const prune = () => {
		for (const entry of entries.values())
			if (!entry.inUse && Date.now() >= Date.parse(entry.preview.expiresAt))
				entries.delete(entry.preview.id);
	};
	const timer = setInterval(prune, 60_000);
	timer.unref();
	const contextFor = (
		id: string,
		requestedBy: string,
		target: PublicationTarget,
	): PublicationGitContext => {
		if (config.mode !== "remote")
			throw new Error("Git context requires remote publication");
		return {
			config,
			job: {
				id,
				requestedBy,
				createdAt: new Date().toISOString(),
				target,
				stage: "queued",
				outcome: "running",
			},
			log: async () => {},
			updateStage: async () => {},
			recordCommit: async () => {},
		};
	};
	const validateLocal = () =>
		validatePublicationDestination({
			checkoutPath: config.checkoutPath,
			repositoryRoot: fileURLToPath(new URL("../../", import.meta.url)),
		});
	const revision = async (lease: PublicationLease) =>
		(
			await lease.database
				.selectFrom("archive_publication_state")
				.select("revision")
				.where("id", "=", 1)
				.executeTakeFirstOrThrow()
		).revision;
	const prepare = async (
		request: PublicationStart,
	): Promise<PublicationPreview> => {
		if (closing)
			throw new PublicationRequestError("Publication runner is closing", 503);
		const lease = await acquirePublicationLease(database);
		if (!lease) throw new PublicationBusyError();
		try {
			const target = await readPublicationTarget(config);
			const status = await readPublicationStatus(lease.database, config);
			const latest = status.latestJob;
			if (latest?.outcome === "running") throw new PublicationBusyError();
			if (request.retryJobId !== undefined) {
				if (
					latest?.id !== request.retryJobId ||
					(latest.outcome !== "failed" && latest.outcome !== "interrupted")
				)
					throw new PublicationRequestError(
						"Retry must identify the latest failed or interrupted publication",
						409,
					);
			} else if (
				latest?.outcome === "failed" ||
				latest?.outcome === "interrupted"
			)
				throw new PublicationRequestError(
					"Explicit Retry is required for the latest publication",
					409,
				);
			prune();
			for (const entry of entries.values())
				if (entry.requestedBy === request.requestedBy && !entry.inUse)
					entries.delete(entry.preview.id);
			if (entries.size >= 8)
				throw new PublicationRequestError(
					"Too many publication previews. Try again after an existing preview expires.",
					409,
				);
			const id = crypto.randomUUID();
			let recovery: PublicationRecovery = { kind: "ready" };
			let baseline: PreparedPublication["baseline"];
			let localFingerprint: string | undefined;
			let before: PublicationArchive;
			let previous: PublicationJob | undefined;
			if (config.mode === "local") {
				await validateLocal();
				const local = await readLocalPublicationFiles(config.checkoutPath);
				localFingerprint = local.fingerprint;
				before = await readPublicationArchive(
					async (file) => local.files.get(file),
					async () =>
						[...local.files.keys()]
							.filter((file) => /^src\/res\/djs\/[^/]+\.json$/.test(file))
							.map((file) => file.slice("src/res/djs/".length)),
				);
			} else {
				const context = contextFor(id, request.requestedBy, target);
				await validatePublicationCheckout(context);
				previous = request.retryJobId
					? await readPublicationJobRecord(lease.database, request.retryJobId)
					: undefined;
				recovery = await reconcilePublicationGit(context, previous, {
					readOnly: true,
				});
				baseline = await fetchPublicationBranch(context);
				before = await readCommitArchive(config.checkoutPath, baseline.commit);
			}
			let sourceRevision = await revision(lease);
			let reviewedRevision: string;
			let documents: ArchiveDocuments | undefined;
			let after: PublicationArchive;
			if (recovery.kind === "ready") {
				const snapshot = await readPublicationSnapshot(lease.database);
				sourceRevision = reviewedRevision = snapshot.revision;
				documents = snapshot.documents;
				const size =
					documents.images.reduce((sum, image) => sum + image.bytes.length, 0) +
					Buffer.byteLength(JSON.stringify({ ...documents, images: [] }));
				if (size > 256 * 1024 * 1024)
					throw new Error("Publication preview exceeds the 256 MB limit");
				after = documentsPublicationArchive(documents);
			} else {
				if (!previous?.revision)
					throw new Error("Interrupted publication has no captured revision");
				reviewedRevision = previous.revision;
				after =
					recovery.kind === "already-pushed"
						? before
						: await readCommitArchive(config.checkoutPath, recovery.commitId);
			}
			const preview: PublicationPreview = {
				id,
				expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
				revision: reviewedRevision,
				changes: comparePublicationArchives(before, after),
			};
			if (closing)
				throw new PublicationRequestError("Publication runner is closing", 503);
			entries.set(id, {
				preview,
				requestedBy: request.requestedBy,
				retryJobId: request.retryJobId,
				target,
				...(documents ? { documents } : {}),
				...(baseline ? { baseline } : {}),
				...(localFingerprint ? { localFingerprint } : {}),
				recovery,
				sourceRevision,
				inUse: false,
			});
			return preview;
		} finally {
			await lease.release();
		}
	};
	return {
		prepare: (request: PublicationStart) => {
			const key = JSON.stringify([request.requestedBy, request.retryJobId]);
			const active = preparations.get(key);
			if (active) return active;
			const task = prepare(request);
			preparations.set(key, task);
			void task.finally(() => preparations.delete(key)).catch(() => {});
			return task;
		},
		validate: async (
			request: PublicationStart,
			lease: PublicationLease,
		): Promise<PreparedPublication> => {
			prune();
			const entry = request.previewId
				? entries.get(request.previewId)
				: undefined;
			if (
				!entry ||
				entry.inUse ||
				entry.requestedBy !== request.requestedBy ||
				entry.retryJobId !== request.retryJobId
			)
				throw new PublicationRequestError(
					"Prepare and review a fresh preview before publishing",
					409,
				);
			entry.inUse = true;
			try {
				if (
					!samePublicationTarget(
						entry.target,
						await readPublicationTarget(config),
					)
				)
					throw new PublicationRequestError(
						"Publication destination changed. Refresh preview before publishing",
						409,
					);
				if ((await revision(lease)) !== entry.sourceRevision)
					throw new PublicationRequestError(
						"Archive data changed. Refresh preview before publishing",
						409,
					);
				if (config.mode === "local") {
					await validateLocal();
					if (
						(await snapshotLocalPublicationFiles(config.checkoutPath)) !==
						entry.localFingerprint
					)
						throw new PublicationRequestError(
							"Local archive files changed. Refresh preview before publishing",
							409,
						);
				} else {
					const context = contextFor(
						entry.preview.id,
						request.requestedBy,
						entry.target,
					);
					await validatePublicationCheckout(context);
					const remote = await fetchPublicationBranch(context);
					if (
						remote.commit !== entry.baseline?.commit ||
						remote.missing !== entry.baseline?.missing
					)
						throw new PublicationRequestError(
							"Target branch changed. Refresh preview before publishing",
							409,
						);
				}
				if ((await revision(lease)) !== entry.sourceRevision)
					throw new PublicationRequestError(
						"Archive data changed. Refresh preview before publishing",
						409,
					);
				return entry;
			} catch (error) {
				entry.inUse = false;
				throw error;
			}
		},
		remove: (entry: PreparedPublication) => {
			entries.delete(entry.preview.id);
		},
		close: async () => {
			closing = true;
			clearInterval(timer);
			await Promise.allSettled([...preparations.values()]);
			entries.clear();
		},
	};
};
