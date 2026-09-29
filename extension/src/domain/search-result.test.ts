// 1. test対象の振る舞いを、最小の入力と期待値で固定する。
// @ts-nocheck
import assert from "node:assert/strict";
import { test } from "vitest";

import { SearchResult } from "./search-result.js";

test("SearchResult normalizes identity without discarding meaningful query parameters", () => {
  const searchResult = SearchResult.fromUntrustedInput({
    query: "  manifest v3 service worker  ",
    url: "https://Example.com/docs/?utm_source=google&page=2#install",
    title: "  Extension docs  ",
    snippet: "  A useful guide.  ",
    locale: "en",
  });

  assert.deepEqual(searchResult.toSerializableMetadata(), {
    query: "manifest v3 service worker",
    url: "https://example.com/docs?page=2",
    title: "Extension docs",
    snippet: "A useful guide.",
    locale: "en",
  });
  assert.equal(
    searchResult.cacheIdentity,
    "manifest v3 service worker\nhttps://example.com/docs?page=2",
  );
});

test("SearchResult rejects data that cannot create a meaningful evaluation", () => {
  assert.throws(
    () =>
      SearchResult.fromUntrustedInput({
        query: "",
        url: "javascript:alert(1)",
        title: "",
        locale: "fr",
      }),
    /query is required/,
  );
});
