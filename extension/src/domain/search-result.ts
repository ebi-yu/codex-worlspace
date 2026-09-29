// 1. 検索結果の入力値を、評価に使える不変なmetadataへ変換する。
export type SupportedLocale = "en" | "ja";

export interface UntrustedSearchResultInput {
  query?: unknown;
  url?: unknown;
  title?: unknown;
  snippet?: unknown;
  locale?: unknown;
}

export interface SearchResultMetadata {
  query: string;
  url: string;
  title: string;
  snippet: string;
  locale: SupportedLocale;
}

const SUPPORTED_LOCALES = new Set<unknown>(["en", "ja"]);
const TRACKING_QUERY_PARAMETER_NAMES = [
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
  "gclid",
];

// 2. 外部入力を検証してから、変更不能な検索結果として保持する。
export class SearchResult {
  readonly metadata: Readonly<SearchResultMetadata>;

  static fromUntrustedInput(
    untrustedInput: UntrustedSearchResultInput | null | undefined,
  ): SearchResult {
    const normalizedQuery = normalizeWhitespace(untrustedInput?.query);
    if (!normalizedQuery) throw new TypeError("query is required");

    const normalizedTitle = normalizeWhitespace(untrustedInput?.title);
    if (!normalizedTitle) throw new TypeError("title is required");

    const normalizedUrl = normalizeHttpUrl(untrustedInput?.url);
    const supportedLocale = untrustedInput?.locale;
    if (!SUPPORTED_LOCALES.has(supportedLocale)) {
      throw new TypeError("locale must be en or ja");
    }

    return new SearchResult({
      query: normalizedQuery,
      url: normalizedUrl,
      title: normalizedTitle,
      snippet: normalizeWhitespace(untrustedInput?.snippet),
      locale: supportedLocale as SupportedLocale,
    });
  }

  private constructor(searchResultMetadata: SearchResultMetadata) {
    this.metadata = Object.freeze(searchResultMetadata);
    Object.freeze(this);
  }

  get cacheIdentity(): string {
    return `${this.metadata.query}\n${this.metadata.url}`;
  }

  toSerializableMetadata(): SearchResultMetadata {
    return { ...this.metadata };
  }
}

function normalizeWhitespace(untrustedText: unknown): string {
  return typeof untrustedText === "string"
    ? untrustedText.trim().replace(/\s+/g, " ")
    : "";
}

// 3. 内容に影響しないtracking情報だけをcache identityから除外する。
function normalizeHttpUrl(untrustedUrl: unknown): string {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(typeof untrustedUrl === "string" ? untrustedUrl : "");
  } catch {
    throw new TypeError("url must be a valid HTTP URL");
  }
  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new TypeError("url must be a valid HTTP URL");
  }
  parsedUrl.hash = "";
  for (const queryParameterName of TRACKING_QUERY_PARAMETER_NAMES) {
    parsedUrl.searchParams.delete(queryParameterName);
  }
  if (parsedUrl.pathname !== "/")
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/$/, "");
  parsedUrl.searchParams.sort();
  return parsedUrl.toString().replace(/\/$/, "");
}
