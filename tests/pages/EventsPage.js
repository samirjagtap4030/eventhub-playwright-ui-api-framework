export class EventsPage {
  constructor(page) {
    this.page       = page;
    this.eventCards = page.getByTestId('event-card');
  }

  async goto() {
    await this.page.goto('/events', { waitUntil: 'domcontentloaded' });
  }

  // Returns the first event card locator
  firstCard() {
    return this.eventCards.first();
  }

  // Returns the title text of a given card
  async getCardTitle(card) {
    return card.locator('h3').innerText();
  }

  // Clicks "Book Now" on a given card
  async clickBookNow(card) {
    await card.getByTestId('book-now-btn').click();
  }
}
