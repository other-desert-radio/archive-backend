import { useCallback, useEffect, useRef, useState } from "react";
import { createShow } from "../../../../loaders/create-show.js";
import { createTag } from "../../../../loaders/create-tag.js";
import { loadDJs } from "../../../../loaders/djs.js";
import type { MixcloudImportAdminRow } from "../../../../loaders/mixcloud-imports.js";
import type { ShowsAdminRow } from "../../../../loaders/shows.js";
import { resolveMixcloudTags } from "../../../../loaders/validate-tags.js";
import { OnboardingModal, useTagOptions } from "../../../shared/modal/index.js";
import {
	buildShowFormRequest,
	ShowDurationField,
	ShowRelationshipFields,
	ShowTitleDateFields,
	useShowFormState,
} from "../../../shows/index.js";
import { MixcloudSourceData } from "../mixcloud-source-data/index.js";
import styles from "./import-show-form.module.css";
import {
	buildImportTagRequests,
	initialImportValues,
	resolveImportDJs,
	resolveImportTags,
} from "./import-show-utils.js";

export type ImportShowFormProps = {
	row: MixcloudImportAdminRow;
	remainingCount: number;
	onClose: () => void;
	onSkip: () => void;
	onPrevious?: (() => void) | undefined;
	onImported: (show: ShowsAdminRow) => void;
};

export const ImportShowForm = ({
	row,
	remainingCount,
	onClose,
	onSkip,
	onPrevious,
	onImported,
}: ImportShowFormProps) => {
	const { fields, setFields, hasUnsavedChanges, addOpeningRelationships } =
		useShowFormState(initialImportValues(row));
	const { tagOptions, isTagsLoading, tagsError, loadTagOptions } =
		useTagOptions(true);
	const [djs, setDJs] = useState<{ id: number; title: string }[]>([]);
	const [unmatchedDJs, setUnmatchedDJs] = useState<string[]>([]);
	const [isResolving, setIsResolving] = useState(true);
	const [pendingTags, setPendingTags] = useState<{
		valid: string[];
		invalid: string[];
	}>();
	const [initialized, setInitialized] = useState(false);
	const [resolutionError, setResolutionError] = useState<string>();
	const versionRef = useRef(0);
	const savedRef = useRef<ShowsAdminRow | undefined>(undefined);
	const initialize = useCallback(() => {
		const version = ++versionRef.current;
		setIsResolving(true);
		setResolutionError(undefined);
		Promise.all([
			loadDJs(),
			resolveMixcloudTags(row.mixcloud_tags?.map(({ key }) => key) ?? []),
		])
			.then(([loadedDJs, resolvedTags]) => {
				if (version !== versionRef.current) return;
				const resolvedDJs = resolveImportDJs(row.decoded_djs ?? [], loadedDJs);
				setDJs(loadedDJs);
				setUnmatchedDJs(resolvedDJs.unmatched);
				addOpeningRelationships({
					selected: resolvedDJs.selected,
					tags: resolvedTags.valid.map(({ tag }) => ({ title: tag.title })),
				});
				setPendingTags({
					valid: resolvedTags.valid.map(({ tag }) => tag.title),
					invalid: resolvedTags.invalid,
				});
			})
			.catch(() => {
				if (version === versionRef.current)
					setResolutionError(
						"Mixcloud DJs or tags could not be resolved. Retry before saving.",
					);
			})
			.finally(() => {
				if (version === versionRef.current) setIsResolving(false);
			});
	}, [row.mixcloud_tags, row.decoded_djs, addOpeningRelationships]);
	useEffect(() => {
		initialize();
		return () => {
			versionRef.current += 1;
		};
	}, [initialize]);
	useEffect(() => {
		if (!pendingTags || isTagsLoading || tagsError !== undefined) return;
		try {
			addOpeningRelationships({
				tags: resolveImportTags(
					pendingTags.valid,
					pendingTags.invalid,
					tagOptions,
					row.mixcloud_tags,
				),
			});
			setPendingTags(undefined);
			setInitialized(true);
		} catch (error) {
			setResolutionError(
				error instanceof Error
					? error.message
					: "Unable to read source tag names.",
			);
		}
	}, [
		pendingTags,
		isTagsLoading,
		tagsError,
		tagOptions,
		row.mixcloud_tags,
		addOpeningRelationships,
	]);

	const canSave =
		initialized &&
		!isResolving &&
		!isTagsLoading &&
		tagsError === undefined &&
		resolutionError === undefined;
	return (
		<OnboardingModal
			isOpen
			title="Import Show"
			submitLabel="Save"
			submittingLabel="Saving…"
			cancelLabel="Cancel"
			onClose={onClose}
			hasUnsavedChanges={hasUnsavedChanges}
			headerContent={<span>{remainingCount} remaining</span>}
			previousNavigationAction={{
				label: "Previous Show",
				onClick: onPrevious ?? (() => {}),
				disabled: onPrevious === undefined,
			}}
			navigationAction={{ label: "Next Show", onClick: onSkip }}
			isSubmitDisabled={!canSave}
			onSubmit={async () => {
				if (!canSave)
					throw new Error(
						"Source suggestions must finish loading before saving.",
					);
				const request = buildShowFormRequest(fields);
				const tagRequests = buildImportTagRequests(fields.tags, tagOptions);
				for (const tagRequest of tagRequests) await createTag(tagRequest);
				savedRef.current = await createShow({
					...request,
					mixcloud_import_id: row.id,
				});
			}}
			onSubmitted={() => {
				if (savedRef.current) onImported(savedRef.current);
			}}
		>
			<MixcloudSourceData row={row} />
			{(isResolving || resolutionError !== undefined) && (
				<div
					className={styles.status}
					role={resolutionError === undefined ? "status" : "alert"}
				>
					{resolutionError ?? "Resolving source DJs and tags…"}
					{resolutionError !== undefined && (
						<button type="button" onClick={initialize}>
							Retry source suggestions
						</button>
					)}
				</div>
			)}
			<ShowTitleDateFields
				fields={fields}
				setFields={setFields}
				idPrefix="import-show"
			/>
			<ShowRelationshipFields
				highlightEmptyDJs
				fields={fields}
				setFields={setFields}
				idPrefix="import-show"
				djs={djs}
				isDJsLoading={isResolving}
				onRetryDJs={initialize}
				tagOptions={tagOptions}
				isTagsLoading={isTagsLoading}
				tagError={tagsError}
				loadTagOptions={loadTagOptions}
				djHelper={
					unmatchedDJs.length > 0 ? (
						<>
							<strong>Unmatched DJs: {unmatchedDJs.join(", ")}</strong>
							<br />
							you'll need to onboard this DJ separately first
						</>
					) : undefined
				}
			/>
			<ShowDurationField
				fields={fields}
				setFields={setFields}
				idPrefix="import-show"
			/>
		</OnboardingModal>
	);
};
