export class EventDetailPage {
  constructor(page) {
    this.page = page;
    // Ticket quantity controls
    // TODO: replace with getByTestId('qty-increment'/'qty-decrement') once data-testid is deployed
    this.ticketCount  = page.locator('#ticket-count');
    this.incrementBtn = page.getByRole('button', { name: '+' });
    this.decrementBtn = page.getByRole('button', { name: '−' }); // Unicode minus U+2212

    // Booking form fields
    this.nameInput  = page.getByLabel('Full Name');
    this.emailInput = page.getByLabel('Email');           // Priority 3: label over ID
    this.phoneInput = page.getByPlaceholder('+91 98765 43210');
    this.confirmBtn = page.locator('.confirm-booking-btn');

    // Confirmation
    this.bookingRef = page.locator('.booking-ref');
  }

  async incrementQuantityTo(target) {
    const current = parseInt(await this.ticketCount.innerText(), 10);
    for (let i = current; i < target; i++) {
      await this.incrementBtn.click();
    }
  }

  // Clicks + until the button becomes disabled (reaches app-enforced max).
  // Returns the final quantity so callers can assert on it.
  async incrementToMax() {
    while (await this.incrementBtn.isEnabled()) {
      await this.incrementBtn.click();
    }
    return parseInt(await this.ticketCount.innerText(), 10);
  }

  async fillAndSubmit({ name, email, phone }) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.phoneInput.fill(phone);
    await this.confirmBtn.click();
  }

  async getBookingRef() {
    await this.bookingRef.waitFor({ state: 'visible' });
    return this.bookingRef.innerText();
  }
}
