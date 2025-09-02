export function getHost() {
    return process.env.HOST || "http://localhost:5173";
}

export function $fetch(url, data) {
    // fetch data thru proxy, JSON.stringify into post body
    return fetch(getHost() + "/api/proxy?url=" + encodeURIComponent(url), {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
    });
}

export function getCredentials(holderName, calendarId) {
    return fetch(getHost() + "/api/credentials?holderName=" + encodeURIComponent(holderName) + "&calendarId=" + encodeURIComponent(calendarId))
        .then(res => res.json());
}

export function setCredential(holderName, calendarId, key, value) {
    return fetch(getHost() + "/api/credentials", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({holderName, calendarId, key, value})
    }).then(res => res.json());
}

export function deleteCredentials(holderName, calendarId) {
    return fetch(getHost() + "/api/credentials", {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({holderName, calendarId})
    }).then(res => res.json());
}