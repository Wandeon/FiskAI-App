// src/lib/regulatory-truth/crawlers/nn-fetcher/index.ts
/**
 * NN Fetcher Module
 *
 * Exports the fetcher for consuming NNFetchJob from sentinel.
 */

export {
  processNNFetchJob,
  extractEliFromHtml,
  extractTitleFromHtml,
  extractPdfLinkFromHtml,
} from "./fetcher"
export type {
  NNFetchJob,
  NNFetcherPolicy,
  NNFetcherResult,
  NNFetcherDependencies,
  NNPageFetcher,
  FetchPageResult,
  ParseJob,
  NNFetchEventType,
} from "./types"
export { DEFAULT_FETCHER_POLICY } from "./types"
