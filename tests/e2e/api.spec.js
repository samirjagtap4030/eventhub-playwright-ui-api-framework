import { test, expect } from '@playwright/test';//

const API_BASE = 'https://api.eventhub.rahulshettyacademy.com/api';
const USER_EMAIL = process.env.TEST_USER_EMAIL;
const USER_PASSWORD = process.env.TEST_USER_PASSWORD;

// Fix #2: Extracted login helper — eliminates duplicated login blocks in TC-002 and TC-003
async function getAuthToken(request) {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: USER_EMAIL, password: USER_PASSWORD },
  });
  const { token } = await res.json();
  return token;
}

test.describe('API Tests', () => {
  // Fix #3: afterAll cleanup — deletes all bookings created during this suite
  // Prevents FIFO pruning from silently removing older bookings after 9 runs
  test.afterAll(async ({ request }) => {
    const token = await getAuthToken(request);
    await request.delete(`${API_BASE}/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Cleanup: all bookings cleared after suite');
  });

  // TC-API-001: Login returns token and user
  test('TC-API-001: POST /auth/login returns token and user on valid credentials', async ({ request }) => {
    const response = await request.post(`${API_BASE}/auth/login`, {
      data: { email: USER_EMAIL, password: USER_PASSWORD },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('token');
    // Fix #5: Assert user.id is present in addition to email
    expect(body.user).toMatchObject({ id: expect.any(Number), email: USER_EMAIL });

    console.log(`Login success. Token received: ${body.token.slice(0, 20)}...`);
  });

  // TC-API-002: GET /events returns paginated event list
  test('TC-API-002: GET /events returns paginated events for authenticated user', async ({ request }) => {
    // Fix #2: Use helper instead of duplicated login block
    const token = await getAuthToken(request);

    const response = await request.get(`${API_BASE}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    // Fix #6: Validate pagination shape, not just presence
    expect(body.pagination).toMatchObject({
      page: expect.any(Number),
      total: expect.any(Number),
      totalPages: expect.any(Number),
      limit: expect.any(Number),
    });

    const event = body.data[0];
    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('title');
    expect(event).toHaveProperty('availableSeats');

    console.log(`Events returned: ${body.data.length}. First: "${event.title}"`);
  });

  // TC-API-003: POST /bookings creates a booking and returns a booking reference
  test('TC-API-003: POST /bookings creates a confirmed booking with a valid reference', async ({ request }) => {
    // Fix #2: Use helper instead of duplicated login block
    const token = await getAuthToken(request);

    // Get first available event
    const eventsRes = await request.get(`${API_BASE}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const { data: events } = await eventsRes.json();
    const event = events.find((e) => e.availableSeats >= 1);
    expect(event).toBeDefined();

    console.log(`Booking event: "${event.title}" (id: ${event.id})`);

    // Create booking
    const response = await request.post(`${API_BASE}/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        eventId: event.id,
        customerName: 'API Test User',
        customerEmail: 'apitest@example.com',
        customerPhone: '9876543210',
        quantity: 1,
      },
    });

    expect(response.status()).toBe(201);

    const body = await response.json();
    const booking = body.data;

    expect(booking).toHaveProperty('bookingRef');
    expect(booking.status).toBe('confirmed');
    expect(booking.quantity).toBe(1);
    // Fix #7: Assert totalPrice = event.price × quantity (business rule §9)
    expect(Number(booking.totalPrice)).toBe(Number(event.price) * 1);
    // Business rule §7: ref first char matches event title first char
    expect(booking.bookingRef.charAt(0).toUpperCase()).toBe(event.title.charAt(0).toUpperCase());
    // Fix #4: Assert full bookingRef format [A-Z]-[A-Z0-9]{6}
    expect(booking.bookingRef).toMatch(/^[A-Z]-[A-Z0-9]{6}$/);

    console.log(`Booking confirmed. Ref: ${booking.bookingRef}`);
  });
});
