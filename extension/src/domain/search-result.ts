export type SupportedLocale = "en" | "ja";
export interface SearchResultInput { query?: unknown; url?: unknown; title?: unknown; snippet?: unknown; locale?: unknown; }
export interface SearchResultValue { query: string; url: string; title: string; snippet: string; locale: SupportedLocale; }
const SUPPORTED_LOCALES = new Set<unknown>(["en", "ja"]);
const TRACKING_PARAMETERS = ["utm_campaign", "utm_content", "utm_medium", "utm_source", "utm_term", "gclid"];

export class SearchResult {
  readonly value: Readonly<SearchResultValue>;
  static create(input: SearchResultInput | null | undefined): SearchResult {
    const query = cleanText(input?.query); if (!query) throw new TypeError("query is required");
    const title = cleanText(input?.title); if (!title) throw new TypeError("title is required");
    const url = normalizeUrl(input?.url);
    if (!SUPPORTED_LOCALES.has(input?.locale)) throw new TypeError("locale must be en or ja");
    return new SearchResult({ query, url, title, snippet: cleanText(input?.snippet), locale: input!.locale as SupportedLocale });
  }
  private constructor(value: SearchResultValue) { this.value = Object.freeze(value); Object.freeze(this); }
  get identity(): string { return `${this.value.query}\n${this.value.url}`; }
  toJSON(): SearchResultValue { return { ...this.value }; }
}
function cleanText(value: unknown): string { return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""; }
function normalizeUrl(value: unknown): string {
  let url: URL; try { url = new URL(typeof value === "string" ? value : ""); } catch { throw new TypeError("url must be a valid HTTP URL"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new TypeError("url must be a valid HTTP URL");
  url.hash = ""; for (const parameter of TRACKING_PARAMETERS) url.searchParams.delete(parameter);
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
  url.searchParams.sort(); return url.toString().replace(/\/$/, "");
}
