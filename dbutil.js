import Database from 'better-sqlite3';

const db = new Database('concal.db');
db.pragma('journal_mode = WAL');

// create tables if not exists
export function init() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS calendars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sources TEXT,
        outputs TEXT
    );
`);

    db.exec(`
    CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        calendar_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        location TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        data_store TEXT,
        FOREIGN KEY(calendar_id) REFERENCES calendars(id)
    );
`);

    db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        holderName TEXT NOT NULL,
        calendar_id INTEGER NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        FOREIGN KEY(calendar_id) REFERENCES calendars(id)
    );
    `);
}

export function createCalendar(name, sources, outputs) {
    const stmt = db.prepare("INSERT INTO calendars (name, sources, outputs) VALUES (?, ?, ?)");
    const info = stmt.run(name, JSON.stringify(sources), JSON.stringify(outputs));
    return info.lastInsertRowid;
}

export function updateCalendar(id, name, sources, outputs) {
    const stmt = db.prepare("UPDATE calendars SET name = ?, sources = ?, outputs = ? WHERE id = ?");
    stmt.run(name, JSON.stringify(sources), JSON.stringify(outputs), id);
}

export function getCalendar(id) {
    const stmt = db.prepare("SELECT * FROM calendars WHERE id = ?");
    let result = stmt.get(id);
    if (!result) {
        return null;
    }

    result["sources"] = JSON.parse(result["sources"]);
    result["outputs"] = JSON.parse(result["outputs"]);

    return result;
}

export function getCalendars() {
    const stmt = db.prepare("SELECT * FROM calendars");
    let results = stmt.all();
    results = results.map((cal) => {
        cal["sources"] = JSON.parse(cal["sources"]);
        cal["outputs"] = JSON.parse(cal["outputs"]);
        return cal;
    });
    return results;
}

export function getCredentials(holderName, calendarId) {
    const stmt = db.prepare("SELECT * FROM credentials WHERE holderName = ? AND calendar_id = ?");
    let results = stmt.all(holderName, calendarId);
    let credObj = {};
    results.forEach((cred) => {
        credObj[cred.key] = cred.value;
    });
    return credObj;
}

function storeCredential(holderName, calendarId, key, value) {
    const stmt = db.prepare("INSERT INTO credentials (holderName, calendar_id, key, value) VALUES (?, ?, ?, ?)");
    stmt.run(holderName, calendarId, key, value);
}

export function setCredential(holderName, calendarId, key, value) {
    const selectStmt = db.prepare("SELECT * FROM credentials WHERE holderName = ? AND calendar_id = ? AND key = ?");
    const existing = selectStmt.get(holderName, calendarId, key);
    if (existing) {
        const updateStmt = db.prepare("UPDATE credentials SET value = ? WHERE id = ?");
        updateStmt.run(value, existing.id);
    } else {
        storeCredential(holderName, calendarId, key, value);
    }
}

export function deleteCredentials(holderName, calendarId) {
    let stmt = db.prepare("DELETE FROM credentials WHERE holderName = ? AND calendar_id = ?");
    stmt.run(holderName, calendarId);
}

export function deleteCalendar(id) {
    // delete associated events and credentials first
    const delEventsStmt = db.prepare("DELETE FROM events WHERE calendar_id = ?");
    delEventsStmt.run(id);

    const delCredsStmt = db.prepare("DELETE FROM credentials WHERE calendar_id = ?");
    delCredsStmt.run(id);

    const stmt = db.prepare("DELETE FROM calendars WHERE id = ?");
    stmt.run(id);
}

export function getEvents(calendarId, startTime, endTime) {
    let query = "SELECT * FROM events WHERE calendar_id = ?";
    const params = [calendarId];

    if (startTime && endTime) {
        query += " AND ((start_time >= ? AND start_time <= ?) OR (end_time >= ? AND end_time <= ?) OR (start_time <= ? AND end_time >= ?))";
        params.push(startTime, endTime, startTime, endTime, startTime, endTime);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params);
}

export function createEvent(calendarId, event) {
    const stmt = db.prepare(`
        INSERT INTO events (calendar_id, title, description, location, start_time, end_time, data_store)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
        calendarId,
        event.title,
        event.description || null,
        event.location || null,
        event.from,
        event.to,
        event.data_store ? JSON.stringify(event.data_store) : null
    );

    return info.lastInsertRowid;
}

export function updateEvent(eventId, event) {
    const stmt = db.prepare(`
        UPDATE events
        SET title = ?, description = ?, location = ?, start_time = ?, end_time = ?, data_store = ?
        WHERE id = ?
    `);

    stmt.run(
        event.title,
        event.description || null,
        event.location || null,
        event.from,
        event.to,
        event.data_store ? JSON.stringify(event.data_store) : null,
        eventId
    );
}

export function deleteEvent(eventId) {
    const stmt = db.prepare("DELETE FROM events WHERE id = ?");
    stmt.run(eventId);
}