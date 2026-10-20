import { useCallback, useEffect, useRef, useState } from "react";
import type {
	PublicationJobDetail,
	PublicationStatus,
} from "../../../publication/index.js";
import {
	connectPublicationStream,
	loadPreviousPublicationJob,
	loadPublicationJob,
	loadPublicationStatus,
	startPublication,
} from "../../loaders/publication.js";
export type PublicationView = {
	status?: PublicationStatus | undefined;
	detail?: PublicationJobDetail | undefined;
	previousAttempts: PublicationJobDetail[];
	historyError?: string | undefined;
	loading: boolean;
	starting: boolean;
	connected: boolean;
	error?: string | undefined;
	refresh: () => Promise<void>;
	start: (retryJobId?: string) => Promise<void>;
};
const message = (error: unknown) =>
	error instanceof Error
		? error.message
		: "Unable to load publication. Try again.";
export const usePublication = (enabled = true): PublicationView => {
	const [status, setStatus] = useState<PublicationStatus>();
	const [detail, setDetail] = useState<PublicationJobDetail>();
	const [previousAttempts, setPreviousAttempts] = useState<
		PublicationJobDetail[]
	>([]);
	const [historyError, setHistoryError] = useState<string>();
	const [historyVersion, setHistoryVersion] = useState(0);
	const [loading, setLoading] = useState(true);
	const [starting, setStarting] = useState(false);
	const [connected, setConnected] = useState(false);
	const [error, setError] = useState<string>();
	const mounted = useRef(true);
	const startingRef = useRef(false);
	const readVersion = useRef(0);
	const refresh = useCallback(async (clearError = true) => {
		if (clearError) setHistoryVersion((version) => version + 1);
		const version = ++readVersion.current;
		try {
			const next = await loadPublicationStatus();
			const nextDetail = next.latestJob
				? await loadPublicationJob(next.latestJob.id)
				: undefined;
			if (mounted.current && version === readVersion.current) {
				setStatus(next);
				setDetail(nextDetail);
				if (clearError) setError(undefined);
			}
		} catch (error) {
			if (mounted.current && version === readVersion.current)
				setError(message(error));
		} finally {
			if (mounted.current && version === readVersion.current) setLoading(false);
		}
	}, []);
	const retryJobId = detail?.job.retryJobId;
	// biome-ignore lint/correctness/useExhaustiveDependencies: explicit reload retries failed history reads
	useEffect(() => {
		let obsolete = false;
		setPreviousAttempts([]);
		setHistoryError(undefined);
		const loadHistory = async () => {
			const attempts: PublicationJobDetail[] = [];
			const seen = new Set<string>();
			let id = retryJobId;
			try {
				while (id && !seen.has(id)) {
					seen.add(id);
					const attempt = await loadPreviousPublicationJob(id);
					if (obsolete) return;
					if (!attempt) break;
					attempts.unshift(attempt);
					id = attempt.job.retryJobId;
				}
				if (!obsolete) setPreviousAttempts(attempts);
			} catch (error) {
				if (!obsolete) {
					setPreviousAttempts(attempts);
					setHistoryError(message(error));
				}
			}
		};
		void loadHistory();
		return () => {
			obsolete = true;
		};
	}, [retryJobId, historyVersion]);
	useEffect(() => {
		mounted.current = true;
		if (!enabled) {
			setLoading(false);
			return;
		}
		const controller = new AbortController();
		let timer: ReturnType<typeof setTimeout> | undefined;
		const connect = async () => {
			await refresh(false);
			if (controller.signal.aborted) return;
			await connectPublicationStream({
				signal: controller.signal,
				onEvent(event) {
					readVersion.current++;
					setConnected(true);
					if (event.type === "status") {
						setStatus(event.status);
						setDetail((previous) =>
							previous && previous.job.id === event.status.latestJob?.id
								? { ...previous, job: event.status.latestJob }
								: previous,
						);
					} else setDetail(event.detail);
				},
				onError() {
					setConnected(false);
				},
			});
			if (!controller.signal.aborted) timer = setTimeout(connect, 2000);
		};
		void connect();
		return () => {
			mounted.current = false;
			readVersion.current++;
			controller.abort();
			clearTimeout(timer);
		};
	}, [enabled, refresh]);
	const start = useCallback(
		async (retryJobId?: string) => {
			if (startingRef.current) return;
			startingRef.current = true;
			setStarting(true);
			setError(undefined);
			try {
				const job = await startPublication(retryJobId);
				if (mounted.current) {
					setDetail({ job, logs: [], logsTruncated: false });
					setStatus((previous) =>
						previous ? { ...previous, latestJob: job } : previous,
					);
				}
				await refresh();
			} catch (error) {
				if (mounted.current) setError(message(error));
			} finally {
				startingRef.current = false;
				if (mounted.current) setStarting(false);
			}
		},
		[refresh],
	);
	return {
		status,
		detail,
		previousAttempts,
		historyError,
		loading,
		starting,
		connected,
		error,
		refresh,
		start,
	};
};
