import {configDotenv} from "dotenv";
import express from "express";
import ViteExpress from "vite-express";
import sources from "./src/sources/sources.js";
import outputs from "./src/outputs/outputs.js";
import {
    init,
    createCalendar,
    getCalendar,
    getCalendars,
    getCredentials,
    setCredential,
    deleteCredentials,
    createEvent,
    getEvents,
    updateEvent,
    deleteEvent,
    updateCalendar,
    deleteCalendar
} from "./dbutil.js";

configDotenv();
init();

const app = express();

app.use(express.json());

app.post("/api/calendar/create", (req, res) => {
    const {name, sources, outputs} = req.body;

    if (!name || !sources || !outputs) {
        return res.status(400).json({error: 'Missing required parameters'});
    }

    // create
    let calendarId = createCalendar(name, sources, outputs);

    res.status(201).json({
        message: 'Calendar created',
        id: calendarId
    });
})

app.get("/api/calendar/info/:id", (req, res) => {
    const {id} = req.params;
    const calendar = getCalendar(id);
    if (!calendar) {
        return res.status(404).json({error: "Calendar not found"});
    }
    res.json(calendar);
});

app.get("/api/calendar/list", async (req, res) => {
    const calendars = getCalendars();
    res.json(calendars);
});

app.post("/api/proxy", async (req, res) => {
    const {url} = req.query;
    let requestInit = req.body;

    if (!url) {
        return res.status(400).json({error: 'Missing url parameter'});
    }

    try {
        if (!requestInit.headers) {
            requestInit.headers = {};
        }

        /* some tricks to make requests more likely to succeed in case of blocking non-browsers */
        requestInit.headers["Accept"] = "*/*";
        requestInit.headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.6831.68 Safari/537.36";
        requestInit.headers['Accept-Language'] = 'en-US,en;q=0.7,cs;q=0.3';
        requestInit.headers['Accept-Encoding'] = 'gzip, deflate, br';
        requestInit.headers['Connection'] = 'keep-alive';


        console.log(`Proxying request to ${url} with options:`, JSON.parse(JSON.stringify(requestInit), (key, value) => {
            if (typeof value === "string" && value.match(/password\s*=/i)) {
                return value.replace(/(password\s*=)[^&\s]*/gi, "$1****")
            }

            if (typeof value === "string" && value.match(/refresh_token\s*=/i)) {
                return value.replace(/(refresh_token\s*=)[^&\s]*/gi, "$1****")
            }

            if (key.toLowerCase().includes("authorization")) {
                return "****";
            }

            return value;
        }));


        const response = await fetch(url, requestInit);
        const data = await response.text();

        // copy headers
        const headers = {};
        response.headers.forEach((value, key) => {
            headers[key] = value;
        });

        res.status(response.status).set(headers).send(data);
    } catch (error) {
        res.status(500).json({error: 'Error fetching the URL', details: error.message});
    }
})

app.get("/api/credentials", async (req, res) => {
    // from query: holderName, calendarId
    const {holderName, calendarId} = req.query;
    if (!holderName || !calendarId) {
        return res.status(400).json({error: 'Missing required parameters'});
    }

    const credentials = getCredentials(holderName, calendarId);
    res.json(credentials);
});

app.put("/api/credentials", async (req, res) => {
    // from body: holderName, calendarId, key, value
    const {holderName, calendarId, key, value} = req.body;
    if (!holderName || !calendarId || !key || !value) {
        return res.status(400).json({error: 'Missing required parameters'});
    }

    // store credential
    setCredential(holderName, calendarId, key, value);

    res.json({message: 'Credential stored'});
});

app.delete("/api/credentials", async (req, res) => {
    // from body: holderName, calendarId
    const {holderName, calendarId} = req.body;
    if (!holderName || !calendarId) {
        return res.status(400).json({error: 'Missing required parameters'});
    }

    // delete credential
    deleteCredentials(holderName, calendarId);
    res.json({message: 'Credentials deleted'});
});

function getSourceOrOutput(name, id, type) {
    if (
        !name ||
        (type === "source" && !sources[name]) ||
        (type === "output" && !outputs[name])
    ) {
        return null;
    }

    return type === "source" ? sources[name](id) : outputs[name](id);
}

app.get("/api/calendar/:id/:type/:name", (req, res) => {
    const {name, id, type} = req.params;

    const object = getSourceOrOutput(name, id, type);

    if (!object) {
        return res.status(404).json({error: "Invalid source or output"});
    }

    res.json(object);
});

app.post("/api/calendar/:id/:type/:name/submit/:idx", async (req, res) => {
    const {name, id, idx, type} = req.params;
    const object = getSourceOrOutput(name, id, type);

    if (!object) {
        return res.status(404).json({error: "Invalid source or output"});
    }

    if (!object || !object.dialogs || !object.dialogs[idx] || !object.dialogs[idx].onSubmit) {
        return res.status(404).json({error: "Dialog not found"});
    }

    try {
        const result = await object.dialogs[idx].onSubmit(req.body);

        if (result.error) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (e) {
        res.status(500).json({error: "Error processing dialog", details: e.message});
    }
});

app.post("/api/calendar/:id/source/:name/pull", async (req, res) => {
    const {id, name} = req.params;

    const calendar = getCalendar(id);
    if (!calendar) {
        return res.status(404).json({error: "Calendar not found"});
    }

    // Kontrola existence zdroje
    if (!name || !sources[name]) {
        return res.status(404).json({error: "Source not found"});
    }

    try {
        const source = sources[name](id);
        const results = [];

        for (const output of source.outputs) {
            const outputData = await output.func(id);

            if (outputData.error) {
                results.push({
                    output: output.name,
                    status: "error",
                    message: outputData.error,
                    detail: outputData.detail || "No details provided"
                });
                continue;
            }

            if (!outputData.events || !Array.isArray(outputData.events) || outputData.events.length === 0) {
                results.push({
                    output: output.name,
                    status: "warning",
                    message: "No events to import"
                });
                continue;
            }

            const fetchedEvents = outputData.events;

            let minTime = null;
            let maxTime = null;

            for (let i = 0; i < fetchedEvents.length; i++){
                const event = fetchedEvents[i];
                const eventStart = new Date(event.from).getTime();
                const eventEnd = new Date(event.to).getTime();

                if (!minTime || eventStart < minTime) minTime = eventStart;
                if (!maxTime || eventEnd > maxTime) maxTime = eventEnd;
            }


            const existingEvents = getEvents(id, new Date(minTime).toISOString(), new Date(maxTime).toISOString());

            const prevGeneratedEvents = existingEvents.filter(event => {
                const dataStore = event.data_store ? JSON.parse(event.data_store) : {};
                return dataStore.source === name && dataStore.output === output.name;
            });

            let addedCount = 0;
            let updatedCount = 0;
            let deletedCount = 0;

            const processedEventIds = new Set();

            for (const fetchedEvent of fetchedEvents) {
                const eventWithMetadata = {
                    ...fetchedEvent,
                    data_store: {
                        source: name,
                        output: output.name
                    }
                };

                const existingEvent = prevGeneratedEvents.find(e =>
                    e.title === fetchedEvent.title && // bad naming sorry
                    e.start_time === fetchedEvent.from &&
                    e.end_time === fetchedEvent.to
                );

                if (existingEvent) {
                    processedEventIds.add(existingEvent.id);

                    if (
                        existingEvent.description !== fetchedEvent.description ||
                        existingEvent.location !== fetchedEvent.location ||
                        existingEvent.start_time !== fetchedEvent.from ||
                        existingEvent.end_time !== fetchedEvent.to // no data store comparison
                    ) {
                        updateEvent(existingEvent.id, eventWithMetadata);
                        updatedCount++;
                    }
                } else {
                    createEvent(id, eventWithMetadata);
                    addedCount++;
                }
            }

            // Delete events that are not in the fetched list
            for (const existingEvent of prevGeneratedEvents) {
                if (!processedEventIds.has(existingEvent.id)) {
                    deleteEvent(existingEvent.id);
                    deletedCount++;
                }
            }

            results.push({
                output: output.name,
                status: "success",
                message: `Total: ${addedCount} added, ${updatedCount} updated, ${deletedCount} deleted`,
                range: {
                    from: minTime,
                    to: maxTime
                }
            });
        }

        res.json({
            message: "Calendar data pulled successfully",
            results
        });
    } catch (error) {
        console.error("Error pulling calendar data:", error);
        res.status(500).json({
            error: "Failed to pull calendar data",
            detail: error.message
        });
    }
});

app.post("/api/calendar/:id/output/:name/push", async (req, res) => {
    const {id, name} = req.params;

    const calendar = getCalendar(id);
    if (!calendar) {
        return res.status(404).json({error: "Calendar not found"});
    }

    if (!name || !outputs[name]) {
        return res.status(404).json({error: "Output not found"});
    }

    const events = await getEvents(id);

    try {
        const output = outputs[name](id);
        const results = [];

        // Projdeme všechny výstupy zdroje
        for (const input of output.inputs) {
            // Zavoláme funkci výstupu pro získání dat
            const inputData = await input.func(id, events);

            // Kontrola, zda nedošlo k chybě
            if (inputData.error) {
                results.push({
                    input: input.name,
                    status: "error",
                    message: inputData.error,
                    detail: inputData.detail || "No details provided"
                });
            } else {

                results.push({
                    input: input.name,
                    status: "success",
                    ...inputData
                });
            }
        }

        res.json({
            message: "Calendar data pushed successfully",
            results
        });
    } catch (error) {
        console.error("Error pushing calendar data:", error);
        res.status(500).json({
            error: "Failed to push calendar data",
            detail: error.message
        });
    }
});

app.get("/api/calendar/:id/events", (req, res) => {
    const {id} = req.params;
    const {startTime, endTime} = req.query;

    // Kontrola existence kalendáře
    const calendar = getCalendar(id);
    if (!calendar) {
        return res.status(404).json({error: "Calendar not found"});
    }

    try {
        const events = getEvents(id, startTime, endTime);
        // Převedení JSON řetězce data_store na objekty
        const formattedEvents = events.map(event => ({
            ...event,
            data_store: event.data_store ? JSON.parse(event.data_store) : null
        }));

        res.json(formattedEvents);
    } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({
            error: "Failed to fetch events",
            detail: error.message
        });
    }
});

app.get("/api/calendar/:id/:type/:name/authenticated", async (req, res) => {
    const {name, id, type} = req.params;
    const object = getSourceOrOutput(name, id, type);

    if (!object) {
        return res.status(404).json({error: "Invalid source or output"});
    }

    if (!object.requireAuth) {
        return res.status(400).json({error: "This source/output does not require authentication"});
    }

    let authenticated = await object.isAuthenticated();

    return res.json({authenticated});
});

app.get("/api/calendar/:id/:type/:name/callback", async (req, res) => {
    const {name, id, type} = req.params;
    const object = getSourceOrOutput(name, id, type);

    if (!object) {
        return res.redirect("/oauth-fail?error=Invalid%20source%20or%20output");
    }

    if (!object.requireAuth) {
        return res.redirect("/oauth-fail?error=Unsupported authorization");
    }

    if (!object.onCallback) {
        return res.redirect("/oauth-fail?error=This%20source/output%20does%20not%20support%20callback");
    }

    try {
        const result = await object.onCallback(req.query);
        if (result.error) {
            return res.redirect(`/oauth-fail?error=${encodeURIComponent(result.error)}`);
        }

        return res.redirect("/dashboard");
    } catch (e) {
        return res.redirect(`/oauth-fail?error=${encodeURIComponent("Error processing callback: " + e.message)}`);
    }
});

app.post("/api/calendar/:id/:type/:name/logout", async (req, res) => {
    const {name, id, type} = req.params;
    const object = getSourceOrOutput(name, id, type);

    if (!object) {
        return res.status(404).json({error: "Source or output not found"});
    }

    // delete credentials for this source
    let credentialHolder = object.credentialHolder;

    if (credentialHolder) {
        deleteCredentials(credentialHolder, id);
        res.json({success: true});
    } else {
        res.status(400).json({error: "Logout is not supported for this source or output"});
    }
});

app.post("/api/calendar/:id/sync", async (req, res) => {
    // this endpoint will pull and then push
    const {id} = req.params;

    if (!id) {
        return res.status(400).json({error: 'Missing calendar ID'});
    }

    const calendar = getCalendar(id);

    if (!calendar.sources || calendar.sources.length === 0) {
        return res.status(400).json({error: 'No sources configured for this calendar'});
    }

    if (!calendar.outputs || calendar.outputs.length === 0) {
        return res.status(400).json({error: 'No outputs configured for this calendar'});
    }

    let finalResults = {
        pull: [],
        push: []
    }

    for (const sourceName of calendar.sources) {
        // use the api to pull
        const pullResults = await fetch(`http://localhost:5173/api/calendar/${id}/source/${sourceName}/pull`, {
            method: "POST"
        }).then(res => res.json());
        if (pullResults.error) {
            return res.status(500).json({error: `Error pulling from source ${sourceName}: ${pullResults.error}`});
        }

        finalResults.pull.push(pullResults);
    }

    for (const outputName of calendar.outputs) {
        // use the api to push
        const pushResults = await fetch(`http://localhost:5173/api/calendar/${id}/output/${outputName}/push`, {
            method: "POST"
        }).then(res => res.json());
        if (pushResults.error) {
            return res.status(500).json({error: `Error pushing to output ${outputName}: ${pushResults.error}`});
        }
        finalResults.push.push(pushResults);
    }

    res.json({
        message: "Calendar synchronized successfully",
        results: finalResults
    });
});

app.post("/api/calendar/:id/rename", async (req, res) => {
    const {id} = req.params;
    const {name} = req.body;

    if (!id || !name) {
        return res.status(400).json({error: 'Missing calendar ID or name'});
    }

    const calendar = getCalendar(id);

    updateCalendar(id, name, calendar.sources, calendar.outputs);

    res.json({message: 'Calendar renamed'});
});

app.put("/api/calendar/:id/source", async (req, res) => {
    const {id} = req.params;
    const {sources} = req.body;

    if (!id || !sources || !Array.isArray(sources)) {
        return res.status(400).json({error: 'Missing calendar ID or sources'});
    }

    const calendar = getCalendar(id);

    if (!calendar) {
        return res.status(404).json({error: 'Calendar not found'});
    }

    updateCalendar(id, calendar.name, sources, calendar.outputs);

    res.json({message: 'Calendar sources updated'});
})

app.put("/api/calendar/:id/output", async (req, res) => {
    const {id} = req.params;
    const {outputs} = req.body;

    if (!id || !outputs || !Array.isArray(outputs)) {
        return res.status(400).json({error: 'Missing calendar ID or outputs'});
    }

    const calendar = getCalendar(id);

    if (!calendar) {
        return res.status(404).json({error: 'Calendar not found'});
    }

    updateCalendar(id, calendar.name, calendar.sources, outputs);

    res.json({message: 'Calendar outputs updated'});
});

app.get("/api/calendar/:id/modules", async (req, res) => {
    const {id} = req.params;
    const calendar = getCalendar(id);
    if (!calendar) {
        return res.status(404).json({error: 'Calendar not found'});
    }
    let sourceList = Object.keys(sources).map(key => {
        return {
            name: key,
            ...sources[key](id) // call without id to get metadata
        }
    });

    let outputList = Object.keys(outputs).map(key => {
        return {
            name: key,
            ...outputs[key](id) // call without id to get metadata
        }
    });

    res.json({
        used: {
            sources: calendar.sources,
            outputs: calendar.outputs
        },
        available: {
            sources: sourceList,
            outputs: outputList
        }
    });
});

app.delete("/api/calendar/:id", async (req, res) => {
    const {id} = req.params;

    if (!id) {
        return res.status(400).json({error: 'Missing calendar ID'});
    }

    const calendar = getCalendar(id);

    if (!calendar) {
        return res.status(404).json({error: 'Calendar not found'});
    }

    deleteCalendar(id);

    res.json({message: 'Calendar deleted'});
});

const server = app.listen(process.env.PORT || 5173, process.env.HOSTNAME || "0.0.0.0", () => {
    console.log("Server is listening... on:", server.address());
    process.env.HOST = `http://${server.address().address}:${server.address().port}`;
});

ViteExpress.bind(app, server);