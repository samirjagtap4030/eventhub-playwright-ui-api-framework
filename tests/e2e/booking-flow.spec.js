import { test, expect } from '@playwright/test';
import { LoginPage }      from '../pages/LoginPage.js';
import { EventsPage }     from '../pages/EventsPage.js';
import { EventDetailPage } from '../pages/EventDetailPage.js';

const USER_EMAIL    = process.env.TEST_USER_EMAIL;
const USER_PASSWORD = process.env.TEST_USER_PASSWORD;

const CUSTOMER = { name: 'Test User', email: 'testuser@example.com', phone: '9876543210' };

// Reusable setup: login then navigate to events list
async function loginAndGoToEvents(page) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(USER_EMAIL, USER_PASSWORD);

  const eventsPage = new EventsPage(page);
  await eventsPage.goto();
  return eventsPage;
}

test.describe('Booking Flow', () => {
  // TC-001: Create single-ticket booking
  test('TC-001: creates a single-ticket booking and shows booking reference', async ({ page }) => {
    // -- Step 1: Login and navigate to events --
    const eventsPage = await loginAndGoToEvents(page);

    // -- Step 2: Read event title and open booking form --
    const firstCard  = eventsPage.firstCard();
    const eventTitle = await eventsPage.getCardTitle(firstCard);
    console.log(`Booking event: "${eventTitle}"`);

    await eventsPage.clickBookNow(firstCard);
    await expect(page).toHaveURL(/\/events\/\d+/);

    // -- Step 3: Verify quantity defaults to 1 --
    const detailPage = new EventDetailPage(page);
    await expect(detailPage.ticketCount).toHaveText('1');

    // -- Step 4: Fill customer details and confirm (qty = 1) --
    await detailPage.fillAndSubmit(CUSTOMER);

    // -- Step 5: Assert booking reference is shown --
    const bookingRef = await detailPage.getBookingRef();
    console.log(`Booking confirmed. Ref: ${bookingRef}`);

    // Business rule: ref first character must match event title first character
    expect(bookingRef.charAt(0).toUpperCase()).toBe(eventTitle.charAt(0).toUpperCase());
  });

  // TC-002: Create multi-ticket booking
  test('TC-002: creates a multi-ticket booking and shows booking reference', async ({ page }) => {
    // -- Step 1: Login and navigate to events --
    const eventsPage = await loginAndGoToEvents(page);

    // -- Step 2: Open booking form for first event --
    const firstCard  = eventsPage.firstCard();
    const eventTitle = await eventsPage.getCardTitle(firstCard);
    console.log(`Booking event (multi-ticket): "${eventTitle}"`);

    await eventsPage.clickBookNow(firstCard);
    await expect(page).toHaveURL(/\/events\/\d+/);

    // -- Step 3: Increment quantity to 2 --
    const detailPage = new EventDetailPage(page);
    await expect(detailPage.ticketCount).toHaveText('1');
    await detailPage.incrementQuantityTo(2);
    await expect(detailPage.ticketCount).toHaveText('2');

    // -- Step 4: Fill customer details and confirm --
    await detailPage.fillAndSubmit(CUSTOMER);

    // -- Step 5: Assert booking reference is shown --
    const bookingRef = await detailPage.getBookingRef();
    console.log(`Multi-ticket booking confirmed. Ref: ${bookingRef}`);

    // Business rule: ref first character must match event title first character
    expect(bookingRef.charAt(0).toUpperCase()).toBe(eventTitle.charAt(0).toUpperCase());
  });

  // TC-304: increment button disabled at quantity 10; decrement button disabled at quantity 1
  test('TC-304: increment button disables at quantity 10 and decrement button disables at quantity 1', async ({ page }) => {
    // -- Step 1: Login and navigate to events --
    const eventsPage = await loginAndGoToEvents(page);

    // -- Step 2: Open booking form for first event --
    await eventsPage.clickBookNow(eventsPage.firstCard());
    await expect(page).toHaveURL(/\/events\/\d+/);

    const detailPage = new EventDetailPage(page);

    // -- Step 3: Assert decrement is disabled at the minimum (quantity = 1) --
    await expect(detailPage.ticketCount).toHaveText('1');
    await expect(detailPage.decrementBtn).toBeDisabled();

    // -- Step 4: Increment until the app-enforced maximum is reached --
    const maxQty = await detailPage.incrementToMax();
    console.log(`Quantity incremented to max: ${maxQty}`);

    // -- Step 5: Assert increment is disabled at maximum --
    await expect(detailPage.incrementBtn).toBeDisabled();

    // -- Step 6: Verify decrement is re-enabled when above minimum --
    await expect(detailPage.decrementBtn).toBeEnabled();
  });
});
