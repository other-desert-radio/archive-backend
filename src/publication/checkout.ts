/**
 * Validate an existing destination and exporter-owned output paths using only
 * filesystem reads. Resolve paths internally to check filesystem boundaries.
 * Reject inaccessible paths, overlap with the backend, and unsafe output entries.
 * Does not inspect Git state or require a Git repository.
 */
export const validatePublicationDestination = async ({
	checkoutPath: _checkoutPath,
	repositoryRoot: _repositoryRoot,
}: {
	checkoutPath: string;
	repositoryRoot: string;
}): Promise<void> => {
	throw new Error("Not implemented: validatePublicationDestination");
};
