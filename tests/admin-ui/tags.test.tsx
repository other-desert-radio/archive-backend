import { describe, expect, test } from "bun:test";
import {
	Tag,
	TagsContainer,
} from "../../src/admin-ui/components/shared/resource-views/index.js";

describe("resource-view tags", () => {
	test("renders colored chips inside an accessible tag list", () => {
		const tag = Tag({ color: "#abcdef", children: "Ambient" });
		const tags = TagsContainer({ label: "DJ One tags", children: tag });

		expect(tags.props["aria-label"]).toBe("DJ One tags");
		expect(tag.props.style.backgroundColor).toBe("#abcdef");
		expect(tag.props.children).toBe("Ambient");
	});
});
