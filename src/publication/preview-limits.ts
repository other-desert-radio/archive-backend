/** Leave room for comparison data, PostgreSQL, and the runtime on small servers. */
export const maxPublicationPreviewBytes = 32 * 1024 * 1024;
export const publicationPreviewSizeError =
	"Publication preview exceeds the 32 MiB limit";
