import { useCallback, useEffect, useState } from "react";
import { loadTags, TagsAdminRow } from "../loaders/tags.js";
import { DatabaseTableView } from "../components/database-table-view.js";
import { TagsTable } from "../components/tables/tags-table.js";

export const TagsPage = () => {
  const [tags, setTags] = useState<TagsAdminRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refreshTags = useCallback(() => {
    setIsLoading(true);
    setError(undefined);

    loadTags()
      .then(setTags)
      .catch(() => setError("The tags could not be loaded."))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refreshTags();
  }, [refreshTags])

  return (
    <DatabaseTableView
      title="Tags"
      isLoading={isLoading}
      error={error}
      onRetry={refreshTags}
      isEmpty={tags.length === 0}
      emptyMessage="No tags have been added yet."
    >
      <TagsTable tags={tags} />
    </DatabaseTableView>
  )
}
