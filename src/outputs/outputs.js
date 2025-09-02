import googleCalendar from "./google-calendar.js";

let cache = {};

function get(source, calendarId, srcName) {
    if (!cache[calendarId]) {
        cache[calendarId] = {};
    }
    if (!cache[calendarId][srcName]) {
        cache[calendarId][srcName] = source(calendarId);
    }
    return cache[calendarId][srcName];
}
export default {
    "Google Calendar": (calendarId) => get(googleCalendar, calendarId, "Google Calendar")
}