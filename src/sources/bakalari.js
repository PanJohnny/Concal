import {$fetch, setCredential, getCredentials} from "../sdk.js";

const REQ_TYPE = "application/x-www-form-urlencoded";
const CREDENTIAL_HOLDER = "bakalari-src";

function bakalari(calendarId) {
    return {
        name: "Bakaláři",
        description: "Import your school schedule from Bakaláři. See your schedule. Coming soon: assignments, events and more in one place.",
        requireAuth: true,
        credentialHolder: CREDENTIAL_HOLDER,
        outputs: [
            {
                name: "Schedule",
                replaceBy: "time-overlap",
                period: 14 /* 14 days max */,
                periodStart: "monday",
                func: fetchSchedule
            }
        ],
        dialogs: [
            {
                name: "Bakaláři login",
                type: "login",
                fields: [
                    {name: "schoolUrl", label: "School URL", type: "url", required: true, placeholder: "e.g. https://school.bakalari.cz/bakaweb"},
                    {name: "username", label: "Username", type: "text", required: true},
                    {name: "password", label: "Password", type: "password", required: true},
                ],
                submitLabel: "Connect",
                onSubmit: async (data) => {
                    // validate URL
                    try {
                        new URL(data.schoolUrl);
                    } catch (e) {
                        return {error: "Invalid URL", detail: e.message};
                    }

                    if (!data.username || !data.password) {
                        return {error: "Missing username or password"};
                    }

                    try {
                        let loginData = await login(data.schoolUrl, data.username, data.password);
                        if (loginData.error) {
                            return {error: "Login failed", detail: loginData.error_description || "Unknown error"};
                        }
                        // store credentials
                        await setCredential(CREDENTIAL_HOLDER, calendarId, "schoolUrl", data.schoolUrl);
                        await setCredential(CREDENTIAL_HOLDER, calendarId, "accessToken", loginData.access_token);
                        await setCredential(CREDENTIAL_HOLDER, calendarId, "refreshToken", loginData.refresh_token);
                        // set expires
                        let expiresAt = Date.now() + (loginData.expires_in * 1000);
                        await setCredential(CREDENTIAL_HOLDER, calendarId, "tokenExpiresAt", expiresAt.toString());

                        return {success: true};
                    } catch (e) {
                        return {error: "Login failed", detail: e.message};
                    }
                }
            }
        ],
        isAuthenticated: async () => {
            let credentials = await getCredentials(CREDENTIAL_HOLDER, calendarId);
            return credentials["accessToken"] && credentials["refreshToken"] && credentials["schoolUrl"];
        }
    }
}

async function login(schoolUrl, username, password) {
    return await $fetch(schoolUrl + "/api/login", {
        method: "POST",
        headers: {
            "Content-Type": REQ_TYPE
        },
        body: `client_id=ANDR&grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
    }).then(res => res.json());
}

async function refreshTokenIfNeccessary(credentials, calendarId) {
    // if expired, then refresh
    if (credentials["tokenExpiresAt"]) {
        let expiresAt = parseInt(credentials["tokenExpiresAt"]);
        if (Date.now() > expiresAt - 60000) { // refresh 1 minute before expiry
            let loginReq = await $fetch(credentials["schoolUrl"] + "/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": REQ_TYPE
                },
                body: `client_id=ANDR&grant_type=refresh_token&refresh_token=${encodeURIComponent(credentials["refreshToken"])}`
            });
            if (loginReq.status === 401) {
                // wait 100 ms and try again once
                await new Promise(resolve => setTimeout(resolve, 100));
                loginReq = await $fetch(credentials["schoolUrl"] + "/api/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": REQ_TYPE
                    },
                    body: `client_id=ANDR&grant_type=refresh_token&refresh_token=${encodeURIComponent(credentials["refreshToken"])}`
                });
            }

            let loginData = await loginReq.json();

            if (loginData.error || !loginReq.ok) {
                throw new Error("Failed to refresh token: " + (loginData.error_description || "Unknown error"));
            }
            // store new credentials
            await setCredential(CREDENTIAL_HOLDER, calendarId, "accessToken", loginData.access_token);
            await setCredential(CREDENTIAL_HOLDER, calendarId, "refreshToken", loginData.refresh_token);
            let newExpiresAt = Date.now() + (loginData.expires_in * 1000);
            await setCredential(CREDENTIAL_HOLDER, calendarId, "tokenExpiresAt", newExpiresAt.toString());
        }
    } else {
        throw new Error("Token expiry not found, please login again.");
    }
}

async function fetchSchedule(calendarId) {
    let credentials = await getCredentials(CREDENTIAL_HOLDER, calendarId);
    try {
        await refreshTokenIfNeccessary(credentials, calendarId);
    } catch (err) {
        return {error: "Authentication error", detail: err.message};
    }
    if (!credentials["schoolUrl"] || !credentials["accessToken"]) {
        return {error: "Missing credentials, please login."};
    }

    let today = new Date();
    let events = await fetchEvents(today, credentials);
    if (events.error) {
        return events;
    }

    let nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    let eventsNextWeek = await fetchEvents(nextWeek, credentials);
    if (eventsNextWeek.error) {
        return eventsNextWeek;
    }

    events = events.concat(eventsNextWeek);

    return { events };
}

async function fetchEvents(startDate, credentials) {
    // GET /api/3/timetable/actual?date=YYYY-MM-dd, date will be today for this week
    let dateStr = startDate.toISOString().split("T")[0];
    let timetable = await $fetch(credentials["schoolUrl"] + `/api/3/timetable/actual?date=${dateStr}`, {
        method: "GET",
        headers: {
            "authorization": "Bearer " + credentials["accessToken"]
        }
    }).then(res => res.json());

    if (!timetable.Hours) {
        return {error: "Failed to fetch timetable."};
    }

    // Vytvoření mapy pro rychlé vyhledávání předmětů, učitelů, místností atd.
    const hoursMap = Object.fromEntries(timetable.Hours.map(hour => [hour.Id, hour]));
    const subjectsMap = Object.fromEntries(timetable.Subjects.map(subject => [subject.Id, subject]));
    const teachersMap = Object.fromEntries(timetable.Teachers.map(teacher => [teacher.Id, teacher]));
    const roomsMap = Object.fromEntries(timetable.Rooms.map(room => [room.Id, room]));
    const groupsMap = Object.fromEntries(timetable.Groups.map(group => [group.Id, group]));

    const events = [];

    // Zpracování dat pro každý den
    for (const day of timetable.Days) {
        const date = new Date(day.Date);

        for (const atom of day.Atoms) {
            // Přeskočit vyřazené hodiny
            if (!atom.SubjectId || atom.Change?.ChangeType === "Removed") continue;

            const hour = hoursMap[atom.HourId];
            const subject = subjectsMap[atom.SubjectId];
            const teacher = teachersMap[atom.TeacherId];
            const room = roomsMap[atom.RoomId];

            // Pokud některá z podstatných informací chybí, přeskočit tuto hodinu
            if (!hour || !subject) continue;

            // Rozdělit čas na hodiny a minuty pro začátek a konec
            const [beginHour, beginMinute] = hour.BeginTime.split(':').map(Number);
            const [endHour, endMinute] = hour.EndTime.split(':').map(Number);

            // Vytvořit Date objekty pro začátek a konec hodiny
            const startDate = new Date(date);
            startDate.setHours(beginHour, beginMinute, 0, 0);

            const endDate = new Date(date);
            endDate.setHours(endHour, endMinute, 0, 0);

            // Sestavení informací o skupinách
            let groupInfo = "";
            if (atom.GroupIds && atom.GroupIds.length > 0) {
                const groups = atom.GroupIds.map(id => groupsMap[id]?.Name || id).join(", ");
                groupInfo = `Skupina: ${groups}\n`;
            }

            // Sestavení titulku a popisu
            const title = `${subject.Name} (${room ? room.Abbrev : "???"})`;
            const description = `${groupInfo}Učitel: ${teacher ? teacher.Name : "???"}\n${atom.Theme || ""}`;

            events.push({
                title,
                from: startDate.toISOString(),
                to: endDate.toISOString(),
                description,
                location: room ? room.Name : "Unknown location",
            });
        }
    }
    return events;
}

export default bakalari;