import { expect } from '@playwright/test';

const API_BASE = 'https://api.eventhub.rahulshettyacademy.com/api';

export class ApiUtils {
    constructor(apiContext, loginPayload) {
        this.apiContext = apiContext;
        this.loginPayload = loginPayload;
    }

    // call LoginApi to get token
    async getToken() {
        const loginResponse = await this.apiContext.post(`${API_BASE}/auth/login`, {
            data: this.loginPayload
        });
        expect(loginResponse.ok()).toBeTruthy();
        const loginResponseJson = await loginResponse.json();
        const token = loginResponseJson.token;
        return token;
    }

    async clearAllBookings(token) {
        const clearResponse = await this.apiContext.delete(`${API_BASE}/bookings`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        expect(clearResponse.ok()).toBeTruthy();
    }

    async getEvents(token) {
        const eventsResponse = await this.apiContext.get(`${API_BASE}/events?limit=100`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        expect(eventsResponse.ok()).toBeTruthy();
        const eventsResponseJson = await eventsResponse.json();
        return eventsResponseJson.data;
    }

    async getEventSeats(eventId, token) {
        const eventResponse = await this.apiContext.get(`${API_BASE}/events/${eventId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        expect(eventResponse.ok()).toBeTruthy();
        const eventResponseJson = await eventResponse.json();
        return eventResponseJson.data.availableSeats;
    }

    async createBooking(bookingPayload, token) {
        const bookingResponse = await this.apiContext.post(`${API_BASE}/bookings`, {
            data: bookingPayload,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });
        expect(bookingResponse.ok()).toBeTruthy();
        const bookingResponseJson = await bookingResponse.json();
        return bookingResponseJson.data;
    }

    async createBookings(singleTicketBookingPayload, multiTicketBookingPayload, staticEventBookingPayload, secondUserToken) {
        let response = {};
        response.token = await this.getToken();// call getToken() to get token in createBookings()
        response.secondUserToken = secondUserToken;

        // precondition: fewer than 9 existing bookings — start from a clean slate
        await this.clearAllBookings(response.token);

        // resolve test events at runtime: 3 static events + one event with >= 10 seats (TC-304 needs quantity max 10)
        const events = await this.getEvents(response.token);
        const staticEvents = events.filter(e => e.isStatic).sort((a, b) => b.totalSeats - a.totalSeats);
        expect(staticEvents.length).toBeGreaterThanOrEqual(3);
        response.staticEvent = staticEvents[0];
        response.singleEvent = staticEvents[1];
        response.multiEvent = staticEvents[2];
        response.qtyEvent = events.find(e => e.availableSeats >= 10);
        expect(response.qtyEvent).toBeTruthy();

        // static event seats as user B sees them BEFORE user A books (TC-104 baseline)
        response.staticSeatsForUserB = await this.getEventSeats(response.staticEvent.id, secondUserToken);

        singleTicketBookingPayload.eventId = response.singleEvent.id;
        response.singleBooking = await this.createBooking(singleTicketBookingPayload, response.token);
        console.log('Single-ticket booking created. Ref:', response.singleBooking.bookingRef);

        multiTicketBookingPayload.eventId = response.multiEvent.id;
        response.multiBooking = await this.createBooking(multiTicketBookingPayload, response.token);
        console.log('Multi-ticket booking created. Ref:', response.multiBooking.bookingRef);

        staticEventBookingPayload.eventId = response.staticEvent.id;
        response.staticBooking = await this.createBooking(staticEventBookingPayload, response.token);
        console.log('Static-event booking created. Ref:', response.staticBooking.bookingRef);

        // user B's seat count must be unchanged by user A's booking (TC-104 business rule)
        const seatsAfter = await this.getEventSeats(response.staticEvent.id, secondUserToken);
        expect(seatsAfter).toBe(response.staticSeatsForUserB);

        return response;// tokens, events, bookings, and seat baseline in response
    }
}
