import { describe, expect, test } from "bun:test";
import { validateTags } from "../../src/utils/validate-tags.js";

const database = {
  selectFrom: () => ({
    select: () => ({
      execute: async () => [{ title: "House" }, { title: "Techno" }],
    }),
  }),
};

describe("validateTags", () => {
  test("returns valid and invalid tags, including empty strings", async () => {
    const result = await validateTags({
      database: database as never,
      tags: [" house ", "unknown", ""],
    });

    expect(result).toEqual({
      valid: ["house"],
      invalid: ["unknown", ""],
    });
  });

  test("matches existing tags case-insensitively", async () => {
    const result = await validateTags({
      database: database as never,
      tags: ["TECHNO"],
    });

    expect(result).toEqual({ valid: ["TECHNO"], invalid: [] });
  });
});
