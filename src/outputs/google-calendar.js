import {google} from 'googleapis';
import {OAuth2Client} from 'google-auth-library';
import {getCredentials, setCredential, getHost} from "../sdk.js";

const CREDENTIAL_HOLDER = "google-calendar-out";

const SCOPES = ["https://www.googleapis.com/auth/calendar.app.created"];



function googleCalendar(calendarId) {
    const HOST = getHost();
    const REDIRECT_URI = `${HOST}/api/calendar/${calendarId}/output/Google%20Calendar/callback`;
    const CLIENT_SECRET = process.env.GCAL_CLIENT_SECRET;
    const CLIENT_ID = process.env.GCAL_CLIENT_ID;

    return {
        name: "Google Calendar",
        description: "Sync your calendar directly with Google Calendar.",
        requireAuth: true,
        credentialHolder: CREDENTIAL_HOLDER,
        inputs: [
            {
                name: "All sources",
                replaceBy: "id-specific,not-found",
                func: pushEvents
            }
        ],
        dialogs: [
            {
                name: "Google Calendar Authorization",
                type: "oauth",
                fields: [],
                submitLabel: "Sign in with Google",
                onSubmit: async () => {
                    // Create an OAuth2 client
                    const oAuth2Client = new OAuth2Client({
                        client_id: CLIENT_ID,
                        client_secret: CLIENT_SECRET,
                        redirectUri: REDIRECT_URI
                    });

                    // Generate the authorization URL
                    const authUrl = oAuth2Client.generateAuthUrl({
                        access_type: 'offline',
                        scope: SCOPES,
                        prompt: 'consent',
                        redirect_uri: REDIRECT_URI
                    });

                    return {url: authUrl};
                }
            },
        ],
        isAuthenticated: async () => {
            let credentials = await getCredentials(CREDENTIAL_HOLDER, calendarId);
            return credentials && credentials.accessToken && credentials.refreshToken;
        },
        onCallback: async (data) => {
            const {code} = data;

            if (!code) {
                return {error: "Missing authorization code"};
            }

            // Create an OAuth2 client
            const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

            try {
                // Exchange the authorization code for tokens
                const {tokens} = await oAuth2Client.getToken(code);
                oAuth2Client.setCredentials(tokens);

                if (!tokens.access_token) {
                    return {error: "Failed to obtain access token"};
                }

                // Store credentials
                await setCredential(CREDENTIAL_HOLDER, calendarId, "accessToken", tokens.access_token);
                if (tokens.refresh_token) {
                    await setCredential(CREDENTIAL_HOLDER, calendarId, "refreshToken", tokens.refresh_token);
                }
                if (tokens.expiry_date) {
                    await setCredential(CREDENTIAL_HOLDER, calendarId, "tokenExpiresAt", tokens.expiry_date.toString());
                }

                return {success: true};
            } catch (e) {
                return {error: "Authorization failed", detail: e.message};
            }
        },
        userOptions: [
            {
                type: "text",
            }
        ]
    }
}

async function pushEvents(calendarId, events) {
    let credentials = await getCredentials(CREDENTIAL_HOLDER, calendarId);
    const CLIENT_SECRET = process.env.GCAL_CLIENT_SECRET;
    const CLIENT_ID = process.env.GCAL_CLIENT_ID;
    if (!credentials || !credentials.accessToken) {
        throw new Error("Missing Google Calendar credentials");
    }

    // Create an OAuth2 client
    const oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET);
    oAuth2Client.setCredentials({
        access_token: credentials.accessToken,
        refresh_token: credentials.refreshToken
    });

    // Set up the Google Calendar API client
    const calendar = google.calendar({version: 'v3', auth: oAuth2Client});
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Check if credentials contain calendar_id, if not create my own calendar and store its id
    if (!credentials.calendar_id) {
        try {
            const res = await calendar.calendars.insert({
                requestBody: {
                    summary: "Concal synced calendar",
                    timeZone
                }
            });
            const newCalendarId = res.data.id;
            credentials.calendar_id = newCalendarId;
            await setCredential(CREDENTIAL_HOLDER, calendarId, "calendar_id", newCalendarId);
            console.log("Created new calendar with ID:", newCalendarId);
        } catch (error) {
            console.error("Error creating new calendar:", error);
            throw new Error("Failed to create new calendar: " + error.message);
        }
    }

    let gEventsResponse = await calendar.events.list({
        calendarId: credentials.calendar_id,
        singleEvents: true
    });

    let gEvents = gEventsResponse.data.items || [];

    let updatedNum = 0;
    let createdNum = 0;
    let deletedNum = 0;

    for (const event of events) {
        const gEvent = {
            summary: event.title,
            description: event.description,
            start: {
                dateTime: event.start_time
            },
            end: {
                dateTime: event.end_time
            },
            iCalUID: event.id + "@concal"
        };

        // Check if the event already exists (by iCalUID)
        let existingEvent = gEvents.find(e => e.iCalUID === gEvent.iCalUID);

        if (existingEvent) {
            // check if anything changed
            if (existingEvent.summary === gEvent.summary &&
                existingEvent.description === gEvent.description &&
                new Date(existingEvent.start.dateTime).getTime() === new Date(gEvent.start.dateTime).getTime() &&
                new Date(existingEvent.end.dateTime).getTime() === new Date(gEvent.end.dateTime).getTime()) {
                continue; // No changes, skip updating
            } else {
                try {
                    await calendar.events.update({
                        calendarId: credentials.calendar_id,
                        eventId: existingEvent.id,
                        resource: gEvent
                    });

                    updatedNum++;
                } catch (error) {
                    console.error("Error updating event in Google Calendar:", error);
                    return {error: "Failed to update event: " + error.message};
                }
                continue;
            }
        }

        try {
            await calendar.events.insert({
                calendarId: credentials.calendar_id,
                resource: gEvent
            });
            createdNum++;
        } catch (error) {
            console.error("Error pushing event to Google Calendar:", error);
            return {error: "Failed to push event: " + error.message};
        }
    }

    // If there are events in gEvents that are not in the current events list, delete them
    for (const gEvent of gEvents) {
        if (!events.find(e => (e.id + "@concal") === gEvent.iCalUID)) {
            try {
                await calendar.events.delete({
                    calendarId: credentials.calendar_id,
                    eventId: gEvent.id
                });

                deletedNum++;
            } catch (error) {
                console.error("Error deleting event from Google Calendar:", error);
                // Not throwing error here to allow other deletions to proceed
            }
        }
    }

    return {success: true, message: `Created: ${createdNum}, Updated: ${updatedNum}, Deleted: ${deletedNum}`};
}

export default googleCalendar;