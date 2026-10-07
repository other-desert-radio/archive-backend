export type { CreatedTag, CreateTagInput } from "./tag-service.js";
export { createTag, createTags } from "./tag-service.js";
export { tagRoutes } from "./tags-route.js";
export type {
	CreateTagRequest,
	CreateTagsRequest,
	ModifyTagFullEditRequest,
	ModifyTagPartialEditRequest,
	ModifyTagRequest,
	ModifyTagReviewRequest,
	RemoveTagRequest,
	RemoveTagResponse,
	ResolveMixcloudTagsResponse,
	TagDeleteImpact,
	ValidateTagsRequest,
} from "./types.js";
export {
	CreateTagRequestPattern,
	CreateTagsRequestPattern,
	ModifyTagFullEditRequestPattern,
	ModifyTagPartialEditRequestPattern,
	ModifyTagRequestPattern,
	ModifyTagReviewRequestPattern,
	RemoveTagRequestPattern,
	ValidateTagsRequestPattern,
} from "./types.js";
