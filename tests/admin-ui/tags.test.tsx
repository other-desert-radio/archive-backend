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

	test("can render a tag chip inline for a table cell", () => {
		const tag = Tag({ as: "span", color: "#abcdef", children: "Ambient" });

		expect(tag.type).toBe("span");
		expect(tag.props.style.backgroundColor).toBe("#abcdef");
	});
});
