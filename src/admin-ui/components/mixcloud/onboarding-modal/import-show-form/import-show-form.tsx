import { useCallback, useEffect, useRef, useState } from "react";
import { createShow } from "../../../../loaders/create-show.js";
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
import { initialImportValues, resolveImportDJs } from "./import-show-utils.js";

export type ImportShowFormProps = {
	row: MixcloudImportAdminRow;
	remainingCount: number;
	onClose: () => void;
	onSkip: () => void;
	onImported: (show: ShowsAdminRow) => void;
};

export const ImportShowForm = ({
	row,
	remainingCount,
	onClose,
	onSkip,
	onImported,
}: ImportShowFormProps) => {
	const { fields, setFields, hasUnsavedChanges, addOpeningRelationships } =
		useShowFormState(initialImportValues(row));
	const { tagOptions, isTagsLoading, tagsError, loadTagOptions } =
		useTagOptions(true);
	const [djs, setDJs] = useState<{ id: number; title: string }[]>([]);
	const [unmatchedDJs, setUnmatchedDJs] = useState<string[]>([]);
	const [invalidKeys, setInvalidKeys] = useState<string[]>([]);
	const [isResolving, setIsResolving] = useState(true);
	const [initialized, setInitialized] = useState(false);
	const [resolutionError, setResolutionError] = useState<string>();
	const versionRef = useRef(0);
	const savedRef = useRef<ShowsAdminRow | undefined>(undefined);
	const initialize = useCallback(() => {
		const version = ++versionRef.current;
		setIsResolving(true);
		setResolutionError(undefined);
		Promise.all([loadDJs(), resolveMixcloudTags(row.mixcloud_tag_keys ?? [])])
			.then(([loadedDJs, resolvedTags]) => {
				if (version !== versionRef.current) return;
				const resolvedDJs = resolveImportDJs(row.decoded_djs ?? [], loadedDJs);
				setDJs(loadedDJs);
				setUnmatchedDJs(resolvedDJs.unmatched);
				setInvalidKeys(resolvedTags.invalid);
				addOpeningRelationships({
					selected: resolvedDJs.selected,
					tags: resolvedTags.valid.map(({ tag }) => tag.title),
				});
				setInitialized(true);
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
	}, [row.mixcloud_tag_keys, row.decoded_djs, addOpeningRelationships]);
	useEffect(() => {
		initialize();
		return () => {
			versionRef.current += 1;
		};
	}, [initialize]);
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
			secondaryAction={{ label: "Skip", onClick: onSkip }}
			navigationAction={{ label: "Next Show", onClick: onSkip }}
			isSubmitDisabled={!canSave}
			onSubmit={async () => {
				if (!canSave)
					throw new Error(
						"Source suggestions must finish loading before saving.",
					);
				savedRef.current = await createShow({
					...buildShowFormRequest(fields),
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
					unmatchedDJs.length > 0
						? `Unmatched DJs: ${unmatchedDJs.join(", ")}`
						: undefined
				}
				tagHelper={
					invalidKeys.length > 0
						? `Unresolved Mixcloud keys: ${invalidKeys.join(", ")}`
						: undefined
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
