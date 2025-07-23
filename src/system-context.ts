import type { Message } from "ai";

type QueryResultSearchResult = {
  date: string;
  title: string;
  url: string;
  snippet: string;
};

type QueryResult = {
  query: string;
  results: QueryResultSearchResult[];
};

type ScrapeResult = {
  url: string;
  result: string;
};

type LocationHints = {
  latitude?: string;
  longitude?: string;
  city?: string;
  country?: string;
};

const toQueryResult = (query: QueryResultSearchResult) =>
  [`### ${query.date} - ${query.title}`, query.url, query.snippet].join("\n\n");

export class SystemContext {
  /**
   * The current step in the loop
   */
  private step = 0;

  /**
   * The history of all queries searched
   */
  private queryHistory: QueryResult[] = [];

  /**
   * The history of all URLs scraped
   */
  private scrapeHistory: ScrapeResult[] = [];

  /**
   * The conversation message history
   */
  private messageHistory: Message[] = [];

  /**
   * User's location information
   */
  private locationHints: LocationHints;

  constructor(messages: Message[] = [], locationHints: LocationHints = {}) {
    this.messageHistory = [...messages];
    this.locationHints = locationHints;
  }

  shouldStop() {
    return this.step >= 10;
  }

  incrementStep() {
    this.step++;
  }

  reportQueries(queries: QueryResult[]) {
    this.queryHistory.push(...queries);
  }

  reportScrapes(scrapes: ScrapeResult[]) {
    this.scrapeHistory.push(...scrapes);
  }

  getMessageHistory(): string {
    return this.messageHistory
      .map((msg) => {
        const role =
          msg.role === "user"
            ? "User"
            : msg.role === "assistant"
              ? "Assistant"
              : msg.role;
        return `<message role="${msg.role}">\n${msg.content}\n</message>`;
      })
      .join("\n\n");
  }

  getCurrentUserQuestion(): string {
    const lastMessage = this.messageHistory[this.messageHistory.length - 1];
    return lastMessage?.content || "";
  }

  getQueryHistory(): string {
    return this.queryHistory
      .map((query) =>
        [
          `## Query: "${query.query}"`,
          ...query.results.map(toQueryResult),
        ].join("\n\n"),
      )
      .join("\n\n");
  }

  getScrapeHistory(): string {
    return this.scrapeHistory
      .map((scrape) =>
        [
          `## Scrape: "${scrape.url}"`,
          `<scrape_result>`,
          scrape.result,
          `</scrape_result>`,
        ].join("\n\n"),
      )
      .join("\n\n");
  }

  getLocationContext(): string {
    if (!this.locationHints.latitude && !this.locationHints.city) {
      return "";
    }

    const parts = [];
    if (this.locationHints.city) {
      parts.push(`City: ${this.locationHints.city}`);
    }
    if (this.locationHints.country) {
      parts.push(`Country: ${this.locationHints.country}`);
    }
    if (this.locationHints.latitude && this.locationHints.longitude) {
      parts.push(
        `Coordinates: ${this.locationHints.latitude}, ${this.locationHints.longitude}`,
      );
    }

    return parts.length > 0
      ? `\nUSER LOCATION CONTEXT:\n${parts.join("\n")}\n`
      : "";
  }
}
