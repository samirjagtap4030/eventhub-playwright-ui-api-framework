// Part 1: Standalone e2e UI+API Test
import { test, expect, request } from '@playwright/test';

const API_BASE = 'https://api.eventhub.rahulshettyacademy.com/api';

const loginPayload = { email: process.env.TEST_USER_EMAIL, password: process.env.TEST_USER_PASSWORD };
const secondUserLoginPayload = { email: process.env.TEST_USER2_EMAIL, password: process.env.TEST_USER_PASSWORD }; // cross-user TCs: TC-104, TC-202

// events are resolved from GET /events at runtime (live seed data changes), so eventId is set in beforeAll
const singleTicketBookingPayload = { customerName: 'Samir Jagtap', customerEmail: 'xxxxxxxxxxx@gmail.com', customerPhone: '9876543210', quantity: 1 }; // TC-001
const multiTicketBookingPayload = { customerName: 'Samir Jagtap', customerEmail: 'xxxxxxxxxxx@gmail.com', customerPhone: '9876543210', quantity: 3 }; // TC-002
const staticEventBookingPayload = { customerName: 'Samir Jagtap', customerEmail: 'xxxxxxxxxxx@gmail.com', customerPhone: '9876543210', quantity: 3 }; // TC-104

// same formatter the app uses for prices ($1,500 style)
const fmtPrice = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

let token;
let secondUserToken;
let singleEvent;
let multiEvent;
let staticEvent;
let qtyEvent;
let singleBooking;
let multiBooking;
let staticBooking;
let staticSeatsForUserB;

test.beforeAll(async () => {
    const apiContext = await request.newContext();

    // LOGIN API — user A
    const loginResponse = await apiContext.post(`${API_BASE}/auth/login`, { data: loginPayload });
    expect(loginResponse.ok()).toBeTruthy();
    const loginResponseJson = await loginResponse.json();
    token = loginResponseJson.token;

    // LOGIN API — user B (cross-user TCs)
    const secondLoginResponse = await apiContext.post(`${API_BASE}/auth/login`, { data: secondUserLoginPayload });
    expect(secondLoginResponse.ok()).toBeTruthy();
    const secondLoginResponseJson = await secondLoginResponse.json();
    secondUserToken = secondLoginResponseJson.token;

    // precondition: fewer than 9 existing bookings (TC-001/TC-002) — start from a clean slate
    const clearResponse = await apiContext.delete(`${API_BASE}/bookings`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    expect(clearResponse.ok()).toBeTruthy();

    // resolve test events at runtime: 3 static events + one event with >= 10 seats (TC-304 needs quantity max 10)
    const eventsResponse = await apiContext.get(`${API_BASE}/events?limit=100`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    expect(eventsResponse.ok()).toBeTruthy();
    const eventsResponseJson = await eventsResponse.json();
    const staticEvents = eventsResponseJson.data.filter(e => e.isStatic).sort((a, b) => b.totalSeats - a.totalSeats);
    expect(staticEvents.length).toBeGreaterThanOrEqual(3);
    staticEvent = staticEvents[0];
    singleEvent = staticEvents[1];
    multiEvent = staticEvents[2];
    qtyEvent = eventsResponseJson.data.find(e => e.availableSeats >= 10);
    expect(qtyEvent).toBeTruthy();

    // static event seats as user B sees them BEFORE user A books (TC-104 baseline)
    const seatsBeforeResponse = await apiContext.get(`${API_BASE}/events/${staticEvent.id}`, {
        headers: { 'Authorization': `Bearer ${secondUserToken}`, 'Content-Type': 'application/json' }
    });
    expect(seatsBeforeResponse.ok()).toBeTruthy();
    const seatsBeforeJson = await seatsBeforeResponse.json();
    staticSeatsForUserB = seatsBeforeJson.data.availableSeats;

    // CREATE BOOKING API — single ticket (TC-001)
    singleTicketBookingPayload.eventId = singleEvent.id;
    const singleBookingResponse = await apiContext.post(`${API_BASE}/bookings`, {
        data: singleTicketBookingPayload,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    expect(singleBookingResponse.ok()).toBeTruthy();
    const singleBookingResponseJson = await singleBookingResponse.json();
    singleBooking = singleBookingResponseJson.data;
    console.log('Single-ticket booking created. Ref:', singleBooking.bookingRef);

    // CREATE BOOKING API — multi ticket (TC-002)
    multiTicketBookingPayload.eventId = multiEvent.id;
    const multiBookingResponse = await apiContext.post(`${API_BASE}/bookings`, {
        data: multiTicketBookingPayload,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    expect(multiBookingResponse.ok()).toBeTruthy();
    const multiBookingResponseJson = await multiBookingResponse.json();
    multiBooking = multiBookingResponseJson.data;
    console.log('Multi-ticket booking created. Ref:', multiBooking.bookingRef);

    // CREATE BOOKING API — user A books the static event (TC-104 setup)
    staticEventBookingPayload.eventId = staticEvent.id;
    const staticBookingResponse = await apiContext.post(`${API_BASE}/bookings`, {
        data: staticEventBookingPayload,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    expect(staticBookingResponse.ok()).toBeTruthy();
    const staticBookingResponseJson = await staticBookingResponse.json();
    staticBooking = staticBookingResponseJson.data;
    console.log('Static-event booking created. Ref:', staticBooking.bookingRef);

    // user B's seat count must be unchanged by user A's booking (TC-104 business rule)
    const seatsAfterResponse = await apiContext.get(`${API_BASE}/events/${staticEvent.id}`, {
        headers: { 'Authorization': `Bearer ${secondUserToken}`, 'Content-Type': 'application/json' }
    });
    expect(seatsAfterResponse.ok()).toBeTruthy();
    const seatsAfterJson = await seatsAfterResponse.json();
    expect(seatsAfterJson.data.availableSeats).toBe(staticSeatsForUserB);
});

test('TC-001: single-ticket booking created via API appears in My Bookings with valid reference', async ({ page }) => {
    expect(singleBooking.status).toBe('confirmed');
    expect(singleBooking.quantity).toBe(1);
    expect(Number(singleBooking.totalPrice)).toBe(Number(singleEvent.price) * 1);
    expect(singleBooking.bookingRef).toMatch(new RegExp(`^${singleEvent.title.charAt(0).toUpperCase()}-[A-Z0-9]{6}$`));

    // login bypass: inject the API token into localStorage before page load
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, token);

    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: singleBooking.bookingRef });
    await expect(card).toBeVisible();
    await expect(card).toContainText(singleEvent.title);
    await expect(card).toContainText('confirmed');
    await expect(card).toContainText(fmtPrice(singleBooking.totalPrice));
});

test('TC-002: multi-ticket booking created via API appears with quantity 3 and correct total price', async ({ page }) => {
    expect(multiBooking.quantity).toBe(3);
    expect(Number(multiBooking.totalPrice)).toBe(Number(multiEvent.price) * 3);
    expect(multiBooking.bookingRef).toMatch(new RegExp(`^${multiEvent.title.charAt(0).toUpperCase()}-[A-Z0-9]{6}$`));

    // login bypass: inject the API token into localStorage before page load
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, token);

    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: multiBooking.bookingRef });
    await expect(card).toBeVisible();
    await expect(card).toContainText(multiEvent.title);
    await expect(card).toContainText('3 tickets');
    await expect(card).toContainText(fmtPrice(multiBooking.totalPrice));
});

test('TC-004: booking detail page shows all sections for a booking created via API', async ({ page }) => {
    // login bypass: inject the API token into localStorage before page load
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, token);

    await page.goto('/bookings');
    const card = page.getByTestId('booking-card').filter({ hasText: singleBooking.bookingRef });
    await card.getByRole('link', { name: 'View Details' }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);

    await expect(page.locator('span.font-mono.font-bold')).toContainText(singleBooking.bookingRef);
    await expect(page.getByRole('heading', { name: singleEvent.title })).toBeVisible();
    await expect(page.getByText('Customer Details')).toBeVisible();
    await expect(page.getByText(singleTicketBookingPayload.customerName)).toBeVisible();
    await expect(page.getByText(singleTicketBookingPayload.customerEmail)).toBeVisible();
    await expect(page.getByText(singleTicketBookingPayload.customerPhone)).toBeVisible();
    await expect(page.getByText('Total Paid')).toBeVisible();
    // total price appears twice for qty 1 (price per ticket + total paid)
    await expect(page.getByText(fmtPrice(singleBooking.totalPrice)).first()).toBeVisible();
    await expect(page.locator('#check-refund-btn')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel Booking' })).toBeVisible();
    await expect(page.getByRole('button', { name: '← Back to My Bookings' })).toBeVisible();
});

test('TC-304: increment button disabled at quantity 10 and decrement button disabled at quantity 1', async ({ page }) => {
    // login bypass: inject the API token into localStorage before page load
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, token);

    await page.goto(`/events/${qtyEvent.id}`);
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
    }, secondUserToken);

    await page.goto(`/events/${staticEvent.id}`);
    await expect(page.getByText(`${staticSeatsForUserB} / ${staticEvent.totalSeats} seats`)).toBeVisible();
});

test('TC-202: user B gets Access Denied when opening user A booking detail', async ({ page }) => {
    // login bypass: second user's token — cross-user access must be blocked
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, secondUserToken);

    await page.goto(`/bookings/${singleBooking.id}`);
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByText('You are not authorized to view this booking.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'View My Bookings' })).toBeVisible();
    await expect(page.locator('span.font-mono.font-bold')).not.toBeVisible();
});

test('TC-005: cancelling a booking via UI shows toast, redirects, and removes it from the list', async ({ page }) => {
    // login bypass: inject the API token into localStorage before page load
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, token);

    await page.goto(`/bookings/${singleBooking.id}`);
    await page.getByRole('button', { name: 'Cancel Booking' }).click();
    await expect(page.getByText('Cancel this booking?')).toBeVisible();
    await page.getByRole('button', { name: 'Yes, cancel it' }).click();

    await expect(page.getByText('Booking cancelled successfully')).toBeVisible();
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(page.locator('.booking-ref', { hasText: singleBooking.bookingRef })).toHaveCount(0);
});

test('TC-006: clear all bookings empties the bookings list', async ({ page }) => {
    // login bypass: inject the API token into localStorage before page load
    await page.addInitScript((value) => {
        window.localStorage.setItem('eventhub_token', value);
    }, token);

    await page.goto('/bookings');
    await expect(page.getByTestId('booking-card').first()).toBeVisible();

    // "Clear all bookings" uses a native confirm() dialog
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Clear all bookings' }).click();

    await expect(page.getByText('No bookings yet')).toBeVisible();
    await expect(page.getByTestId('booking-card')).toHaveCount(0);
});
