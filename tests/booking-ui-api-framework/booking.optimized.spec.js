// Part 2: Optimized e2e UI+API Test
import { test, expect, request } from '@playwright/test';
import { ApiUtils } from './utils/ApiUtils.js';

const loginPayload = { email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD };
const secondUserLoginPayload = { email: process.env.TEST_USER2_EMAIL, password: process.env.TEST_USER_PASSWORD }; // cross-user TCs: TC-104, TC-202

// events are resolved from GET /events at runtime (live seed data changes), so eventId is set in createBookings()
const singleTicketBookingPayload = { customerName: 'Samir Jagtap', customerEmail: 'xxxxxxxxxxx@gmail.com', customerPhone: '9876543210', quantity: 1 }; // TC-001
const multiTicketBookingPayload = { customerName: 'Samir Jagtap', customerEmail: 'xxxxxxxxxxx@gmail.com', customerPhone: '9876543210', quantity: 3 }; // TC-002
const staticEventBookingPayload = { customerName: 'Samir Jagtap', customerEmail: 'xxxxxxxxxxx@gmail.com', customerPhone: '9876543210', quantity: 3 }; // TC-104

// same formatter the app uses for prices ($1,500 style)
const fmtPrice = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

let response;
test.beforeAll(async () => {
    const apiContext = await request.newContext();
    const secondUserToken = await new ApiUtils(apiContext, secondUserLoginPayload).getToken();
    const apiUtils = new ApiUtils(apiContext, loginPayload);
    response = await apiUtils.createBookings(singleTicketBookingPayload, multiTicketBookingPayload, staticEventBookingPayload, secondUserToken);
});

test('TC-001: single-ticket booking created via API appears in My Bookings with valid reference', async ({ page }) => {
    expect(response.singleBooking.status).toBe('confirmed');
    expect(response.singleBooking.quantity).toBe(1);
    expect(Number(response.singleBooking.totalPrice)).toBe(Number(response.singleEvent.price) * 1);
    expect(response.singleBooking.bookingRef).toMatch(new RegExp(`^${response.singleEvent.title.charAt(0).toUpperCase()}-[A-Z0-9]{6}$`));

    // login bypass: inject the API token into localStorage before page load
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, response.token);

    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: response.singleBooking.bookingRef });
    await expect(card).toBeVisible();
    await expect(card).toContainText(response.singleEvent.title);
    await expect(card).toContainText('confirmed');
    await expect(card).toContainText(fmtPrice(response.singleBooking.totalPrice));
});

test('TC-002: multi-ticket booking created via API appears with quantity 3 and correct total price', async ({ page }) => {
    expect(response.multiBooking.quantity).toBe(3);
    expect(Number(response.multiBooking.totalPrice)).toBe(Number(response.multiEvent.price) * 3);
    expect(response.multiBooking.bookingRef).toMatch(new RegExp(`^${response.multiEvent.title.charAt(0).toUpperCase()}-[A-Z0-9]{6}$`));

    // login bypass: inject the API token into localStorage before page load
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, response.token);

    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: response.multiBooking.bookingRef });
    await expect(card).toBeVisible();
    await expect(card).toContainText(response.multiEvent.title);
    await expect(card).toContainText('3 tickets');
    await expect(card).toContainText(fmtPrice(response.multiBooking.totalPrice));
});

test('TC-004: booking detail page shows all sections for a booking created via API', async ({ page }) => {
    // login bypass: inject the API token into localStorage before page load
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, response.token);

    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: response.singleBooking.bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    await expect(page.locator('span.font-mono.font-bold')).toContainText(response.singleBooking.bookingRef);
    await expect(page.getByRole('heading', { name: response.singleEvent.title })).toBeVisible();
    await expect(page.getByText('Customer Details')).toBeVisible();
    await expect(page.getByText(singleTicketBookingPayload.customerName)).toBeVisible();
    await expect(page.getByText(singleTicketBookingPayload.customerEmail)).toBeVisible();
    await expect(page.getByText(singleTicketBookingPayload.customerPhone)).toBeVisible();
    await expect(page.getByText('Total Paid')).toBeVisible();
    // total price appears twice for qty 1 (price per ticket + total paid)
    await expect(page.getByText(fmtPrice(response.singleBooking.totalPrice)).first()).toBeVisible();
    await expect(page.locator('#check-refund-btn')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel Booking' })).toBeVisible();
    await expect(page.getByRole('button', { name: '← Back to My Bookings' })).toBeVisible();
});

test('TC-304: increment button disabled at quantity 10 and decrement button disabled at quantity 1', async ({ page }) => {
    // login bypass: inject the API token into localStorage before page load
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, response.token);

    await page.goto(`/events/${response.qtyEvent.id}`);
    await expect(page.locator('#ticket-count')).toHaveText('1');
    // decrement button label is the unicode minus sign '−', not '-'
    await expect(page.getByRole('button', { name: '−' })).toBeDisabled();

    for (let i = 0; i < 9; ++i) {
        await page.getByRole('button', { name: '+', exact: true }).click();
    }
    await expect(page.locator('#ticket-count')).toHaveText('10');
    await expect(page.getByRole('button', { name: '+', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '−' })).toBeEnabled();
});

test('TC-104: static event seats are not reduced for another user by user A bookings', async ({ page }) => {
    // login bypass: second user's token — user B must see seats unaffected by user A's booking
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, response.secondUserToken);

    await page.goto(`/events/${response.staticEvent.id}`);
    await expect(page.getByText(`${response.staticSeatsForUserB} / ${response.staticEvent.totalSeats} seats`)).toBeVisible();
});

test('TC-202: user B gets Access Denied when opening user A booking detail', async ({ page }) => {
    // login bypass: second user's token — cross-user access must be blocked
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, response.secondUserToken);

    await page.goto(`/bookings/${response.singleBooking.id}`);
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByText('You are not authorized to view this booking.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'View My Bookings' })).toBeVisible();
    await expect(page.locator('span.font-mono.font-bold')).not.toBeVisible();
});

test('TC-005: cancelling a booking via UI shows toast, redirects, and removes it from the list', async ({ page }) => {
    // login bypass: inject the API token into localStorage before page load
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, response.token);

    await page.goto(`/bookings/${response.singleBooking.id}`);
    await page.getByRole('button', { name: 'Cancel Booking' }).click();
    await expect(page.getByText('Cancel this booking?')).toBeVisible();
    await page.getByRole('button', { name: 'Yes, cancel it' }).click();

    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(page.locator('.booking-ref', { hasText: response.singleBooking.bookingRef })).toHaveCount(0);
});

test('TC-006: clear all bookings empties the bookings list', async ({ page }) => {
    // login bypass: inject the API token into localStorage before page load
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, response.token);

    await page.goto('/bookings');
    await expect(page.getByTestId('booking-card').first()).toBeVisible();

    // "Clear all bookings" uses a native confirm() dialog
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Clear all bookings' }).click();

    await expect(page.getByText('No bookings yet')).toBeVisible();
    await expect(page.getByTestId('booking-card')).toHaveCount(0);
});
