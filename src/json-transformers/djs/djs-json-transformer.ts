import {
  groupRelationshipIds,
  mergeRelationshipIds,
} from "../utils/relationship-ids.js";
import type { DJsJSON, TransformDJsParams } from "./types.js";

/**
 * Converts database rows and relationship rows into the public DJ JSON shape.
 *
 * DJs without related shows or tags receive empty arrays. Nullable database
 * images are omitted from the response so the JSON uses an optional `image`
 * field rather than exposing SQL `NULL`.
 *
 * @example
 * ```ts
 * transformDJs({
 *   djs: [{ id: 1, title: "DJ One", bio: "Bio", image: null }],
 *   showDJs: [{ dj_id: 1, show_id: 10 }],
 *   djTags: [{ dj_id: 1, tag_id: 20 }],
 *   showTags: [{ dj_id: 1, tag_id: 21 }],
 * });
 * // [{ id: 1, title: "DJ One", bio: "Bio", shows: [10], tags: [20, 21] }]
 * ```
 */
export const transformDJs = ({
  djs,
  showDJs,
  djTags,
  showTags,
}: TransformDJsParams): DJsJSON[] => {
  const showsByDj = groupRelationshipIds({
    rows: showDJs,
    groupId: "dj_id",
    gatherId: "show_id",
  });
  const tagsByDj = mergeRelationshipIds(
    groupRelationshipIds({
      rows: djTags,
      groupId: "dj_id",
      gatherId: "tag_id",
    }),
    groupRelationshipIds({
      rows: showTags,
      groupId: "dj_id",
      gatherId: "tag_id",
    }),
  );

  return djs.map((dj) => ({
    id: dj.id,
    title: dj.title,
    bio: dj.bio,
    ...(dj.image === null ? {} : { image: dj.image }),
    shows: showsByDj.get(dj.id) ?? [],
    tags: tagsByDj.get(dj.id) ?? [],
  }));
};
