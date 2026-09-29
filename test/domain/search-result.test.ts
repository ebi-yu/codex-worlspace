// @ts-nocheck -- browser/provider boundary is runtime-validated; see ADR 0002.
import assert from "node:assert/strict";
import test from "node:test";

import { SearchResult } from "../../extension/src/domain/search-result.js";

test("SearchResult normalizes identity without discarding meaningful query parameters", () => {
  const result = SearchResult.create({
    query: "  manifest v3 service worker  ",
    url: "https://Example.com/docs/?utm_source=google&page=2#install",
    title: "  Extension docs  ",
    snippet: "  A useful guide.  ",
    locale: "en",
  });

  assert.deepEqual(result.toJSON(), {
    query: "manifest v3 service worker",
    url: "https://example.com/docs?page=2",
    title: "Extension docs",
    snippet: "A useful guide.",
    locale: "en",
  });
  assert.equal(result.identity, "manifest v3 service worker\nhttps://example.com/docs?page=2");
});

test("SearchResult rejects data that cannot create a meaningful evaluation", () => {
  assert.throws(
    () =>
      SearchResult.create({
        query: "",
        url: "javascript:alert(1)",
        title: "",
        locale: "fr",
      }),
    /query is required/,
  );
});
