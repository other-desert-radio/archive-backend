import { type ReactElement, useEffect, useState } from "react";
import type { MixcloudStatus } from "../../admin/routes/mixcloud/index.js";
import { Banner } from "../components/shared/resource-views/index.js";
import styles from "../components/shared/resource-views/resource-view/resource-view.module.css";
import {
	connectMixcloud,
	disconnectMixcloud,
	loadMixcloudConnection,
} from "../loaders/mixcloud-connection.js";
import uploadStyles from "./upload-page.module.css";

const callbackMessage = (): string | undefined => {
	if (typeof window === "undefined") return undefined;
	switch (new URLSearchParams(window.location.search).get("mixcloud")) {
		case "denied":
			return "Mixcloud sign-in was cancelled.";
		case "invalid_attempt":
			return "This Mixcloud sign-in attempt expired or was already used. Please sign in again.";
		case "unavailable":
			return "Mixcloud sign-in is not configured. Contact an administrator.";
		case "failed":
			return "Unable to connect to Mixcloud. Please try again.";
		default:
			return undefined;
	}
};

/** Owns the Mixcloud upload page presentation. */
export const UploadPage = (): ReactElement => {
	const [status, setStatus] = useState<MixcloudStatus>();
	const [loading, setLoading] = useState(true);
	const [pending, setPending] = useState<"connecting" | "disconnecting">();
	const [error, setError] = useState<string>();
	const [notice, setNotice] = useState(callbackMessage);

	useEffect(() => {
		let active = true;
		// Callback outcomes explain the trip; server status decides which account is connected.
		const url = new URL(window.location.href);
		if (url.searchParams.has("mixcloud")) {
			url.searchParams.delete("mixcloud");
			window.history.replaceState(window.history.state, "", url);
		}
		loadMixcloudConnection()
			.then((result) => {
				if (active) setStatus(result);
			})
			.catch((failure: unknown) => {
				if (active)
					setError(
						failure instanceof Error
							? failure.message
							: "Unable to check your Mixcloud connection.",
					);
			})
			.finally(() => {
				if (active) setLoading(false);
			});
		return () => {
			active = false;
		};
	}, []);

	const reload = async () => {
		setLoading(true);
		setError(undefined);
		try {
			setStatus(await loadMixcloudConnection());
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: "Unable to check your Mixcloud connection.",
			);
		} finally {
			setLoading(false);
		}
	};
	const signIn = async () => {
		setPending("connecting");
		setError(undefined);
		setNotice(undefined);
		try {
			window.location.assign(await connectMixcloud());
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: "Unable to start Mixcloud sign-in.",
			);
			setPending(undefined);
		}
	};
	const signOut = async () => {
		setPending("disconnecting");
		setError(undefined);
		setNotice(undefined);
		try {
			await disconnectMixcloud();
			setStatus({ configured: true, connected: false });
		} catch (failure) {
			setError(
				failure instanceof Error
					? failure.message
					: "Unable to sign out of Mixcloud.",
			);
		} finally {
			setPending(undefined);
		}
	};
	const busy = loading || pending !== undefined;
	return (
		<section className={styles.view}>
			<header className={`${styles.header} ${uploadStyles.header}`}>
				<h1>MIXCLOUD UPLOAD</h1>
			</header>
			<Banner
				leading={
					<div aria-live="polite">
						{loading ? (
							<p>Checking your Mixcloud connection…</p>
						) : !status ? (
							<p>Unable to check your Mixcloud connection.</p>
						) : !status.configured ? (
							<p>
								Mixcloud sign-in is not configured. Contact an administrator.
							</p>
						) : status.connected ? (
							<>
								<p>
									Signed into Mixcloud as{" "}
									<strong>{status.account.displayName}</strong> (
									{status.account.key}).
								</p>
								<p>
									To switch accounts, sign out here. You may also need to sign
									out on Mixcloud.
								</p>
							</>
						) : (
							<p>
								You are not currently signed into mixcloud. Sign in to mixcloud
								to begin uploading a show.
							</p>
						)}
						{notice && <p role="status">{notice}</p>}
						{error && <p role="alert">{error}</p>}
					</div>
				}
				trailing={
					<>
						{status?.connected ? (
							<button
								type="button"
								className={uploadStyles.signIn}
								onClick={() => void signOut()}
								disabled={busy}
							>
								{pending === "disconnecting"
									? "signing out…"
									: "sign out of mixcloud"}
							</button>
						) : (
							<button
								type="button"
								className={uploadStyles.signIn}
								onClick={() => void signIn()}
								disabled={busy || !status?.configured}
							>
								{pending === "connecting"
									? "connecting…"
									: "sign into mixcloud"}
							</button>
						)}
						{error && (
							<button
								type="button"
								className={uploadStyles.signIn}
								onClick={() => void reload()}
								disabled={busy}
							>
								reload connection
							</button>
						)}
					</>
				}
			/>
		</section>
	);
};
