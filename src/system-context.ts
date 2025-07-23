import type { Message } from "ai";

type SearchResult = {
  date: string;
  title: string;
  url: string;
  snippet: string;
  summary: string; // Changed from scrapedContent to summary
};

type SearchHistoryEntry = {
  query: string;
  results: SearchResult[];
};

type LocationHints = {
  latitude?: string;
  longitude?: string;
  city?: string;
  country?: string;
};

export class SystemContext {
  /**
   * The current step in the loop
   */
  private step = 0;

  /**
   * The history of all searches (including scraped content)
   */
  private searchHistory: SearchHistoryEntry[] = [];

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

  reportSearch(search: SearchHistoryEntry) {
    this.searchHistory.push(search);
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

  getSearchHistory(): string {
    return this.searchHistory
      .map((search) =>
        [
          `## Query: "${search.query}"`,
          ...search.results.map((result) =>
            [
              `### ${result.date} - ${result.title}`,
              result.url,
              result.snippet,
              `<summary>`,
              result.summary,
              `</summary>`,
            ].join("\n\n"),
          ),
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
