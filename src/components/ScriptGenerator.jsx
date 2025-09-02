import {useEffect, useState} from "react";

function ScriptGenerator({calendarId}) {
    let [os, setOs] = useState("");
    let [frequency, setFrequency] = useState(60);
    let [script, setScript] = useState("");

    const PORT = window.location.port ? `:${window.location.port}` : "";
    const BASE_URL = `${window.location.protocol}//${window.location.hostname}${PORT}`;
    const SYNC_URL = `${BASE_URL}/api/calendar/${calendarId}/sync`;


    useEffect(() => {
        if (os === "linux") {
            setScript(
                `#!/bin/bash
curl -X POST ${SYNC_URL} -H "Content-Type: application/json" > /dev/null 2>&1`
            );
        } else if (os === "windows") {
            setScript(`-Command "Invoke-RestMethod -Uri '${SYNC_URL}' -Method Post -ContentType 'application/json' > $null 2>&1"`);
        }

    }, [os, frequency, SYNC_URL, calendarId]);

    return (
        <>
            <label>
                Select your OS:
                <select id={"os-select"} onChange={(e) => setOs(e.target.value)}>
                    <option value={"null"} disabled selected>
                        Choose one
                    </option>
                    <option value={"linux"}>Linux (cron)</option>
                    <option value={"windows"}>Windows (Task Scheduler)</option>
                </select>
            </label>

            {os === "linux" && (
                <label title={"Recommended ammount is at least 30 minutes due to rate limiting on some services"}>
                    Set your frequency (in minutes):
                    <input type={"number"} id={"frequency-input"} defaultValue={frequency} min={30}
                           onChange={(e) => setFrequency(e.target.value)}/>
                </label>
            )}

            {os && script && script.length > 0 && (
                <div className={"script-output"}>
                    <h3>Your script</h3>
                    <p>In order for your {os} to call this script do the following:</p>
                    {os === "linux" && (
                        <ol>
                            <li>Enter terminal</li>
                            <li>Edit your crontab with <code>crontab -e</code></li>
                            <li>Add the following line to run the script every {frequency} minutes:
                                <br/>
                                <code>*/{frequency} * * * * {script}</code>
                            </li>
                            <li>Save and exit the editor. Your cron job is now set up!</li>
                        </ol>
                    )}
                    {os === "windows" && (
                        <ol>
                            <li>Open Task Scheduler</li>
                            <li>Click on "Create Basic Task..." in the Actions pane on the right.</li>
                            <li>Name your task and provide a description, then click "Next".</li>
                            <li>Choose the frequency (Daily, Weekly, etc.) and click "Next". Recommended is minimum every 1 hour, minimum 30 minutes.</li>
                            <li>Set the start date and time, then click "Next".</li>
                            <li>Select "Start a program" and click "Next".</li>
                            <li>In the "Program/script" field, enter <code>powershell</code>.</li>
                            <li>In the "Add arguments (optional)", paste the following:
                                <br/>
                                <code>{script}</code>
                            </li>
                            <li>Click "Next", review your settings, and click "Finish" to create the task.</li>
                        </ol>
                    )}
                    <button onClick={() => {
                        navigator.clipboard.writeText(script);
                        window.displayMessage("Copied to clipboard");
                    }}>Copy to clipboard</button>
                </div>
            )}
        </>
    )
}

export default ScriptGenerator;