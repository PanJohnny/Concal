import {useEffect, useState} from "react";
import "./Dashboard.css";
import Calendar from "../components/Calendar";
import Source from "../components/Source";
import Output from "../components/Output.jsx";
import ScriptGenerator from "../components/ScriptGenerator.jsx";

function Dashboard() {
    const calId = localStorage.getItem("current-calendar-id");
    let [syncing, setSyncing] = useState(false);
    let [calendar, setCalendar] = useState({
        name: "",
        sources: [],
        outputs: []
    });

    let [modules, setModules] = useState({
        used: {
            sources: [],
            outputs: []
        },
        available: {
            sources: [],
            outputs: []
        }
    });

    let [sources, setSources] = useState({});
    let [outputs, setOutputs] = useState({});

    useEffect(() => {
        if (calId === null) {
            window.location.href = "/calendars";
            return;
        }

        async function fetchCalendar() {
            let calendarData = await fetch("/api/calendar/info/" + calId).then(res => res.json());
            if (calendarData.error) {
                window.location.href = "/onboarding";
            }

            setCalendar(calendarData);
        }

        fetchCalendar();
    }, [calId]);

    useEffect(() => {
        async function fetchSources() {
            // fetch sources and set them to the window.sources object
            // /api/calendar/:id/source/:name
            for (let sourceName of calendar.sources) {
                if (!window.sources) {
                    window.sources = {};
                }
                if (window.sources[sourceName]) {
                    continue;
                }
                window.sources[sourceName] = await fetch("/api/calendar/" + calId + "/source/" + sourceName).then(res => res.json());
            }
            setSources(window.sources);
        }

        async function fetchOutputs() {
            for (let outputName of calendar.outputs) {
                if (!window.outputs) {
                    window.outputs = {};
                }
                if (window.outputs[outputName]) {
                    continue;
                }
                window.outputs[outputName] = await fetch("/api/calendar/" + calId + "/output/" + outputName).then(res => res.json());
            }
            setOutputs(window.outputs);
        }

        async function fetchModules() {
            const mils = await fetch("/api/calendar/" + calId + "/modules").then(res => res.json());
            if (mils) {
                setModules(mils);
            }
        }

        fetchSources();
        fetchOutputs();
        fetchModules();
    }, [calendar, calId]);

    return (
        <>
            <div className={"harmonica"}>
                <div className={"sources"}>
                    <h3>Manage sources</h3>
                    {calendar.sources.map((s) => <div className={"source-settings"} data-source={s}>
                        <h4>{s}</h4>
                        {
                            sources && sources[s] ? <Source source={sources[s]} calId={calId}/> : <div>Loading...</div>
                        }
                    </div>)}
                    <button title={"Add or remove sources"}
                            onClick={() => document.querySelector("#source-list").showModal()}
                            style={{margin: "10px"}}>Add/Remove Sources
                    </button>
                    <dialog id={"source-list"}>
                        <h2>Add or remove sources</h2>
                        <div className={"flex-column"}>
                            {modules.available.sources.length > 0 ? modules.available.sources.map((s) => <>
                                <label className={"source"}>
                                    <div className={"space-between"}>
                                        <h5>{s.name}</h5>
                                        <input type={"checkbox"} onChange={async (e) => {
                                            let checked = e.target.checked;
                                            let srcName = s.name;

                                            let newSources;
                                            // check if it is different from current state
                                            if (checked && !calendar.sources.includes(srcName)) {
                                                newSources = [...calendar.sources, srcName];
                                            } else if (!checked && calendar.sources.includes(srcName)) {
                                                newSources = calendar.sources.filter((src) => src !== srcName);
                                            }
                                            if (newSources) {
                                                let res = await fetch("/api/calendar/" + calId + "/source", {
                                                    method: "PUT",
                                                    headers: {
                                                        "Content-Type": "application/json"
                                                    },
                                                    body: JSON.stringify({sources: newSources})
                                                });
                                                let data = await res.json();
                                                if (res.ok && !data.error) {
                                                    setCalendar({...calendar, sources: newSources});
                                                    window.displayMessage("Sources updated successfully", "success");
                                                } else {
                                                    window.displayMessage("Failed to update sources: " + (data.error || res.statusText), "error");
                                                }
                                            }
                                        }
                                        } checked={calendar.sources.includes(s.name)}/>
                                    </div>
                                    <p>
                                        {s.description}
                                    </p>
                                </label>
                            </>) : <p>No available sources</p>}
                            <label className={"source disabled"}>
                                <div>
                                    <h5>Create your own</h5>
                                    <input type={"checkbox"} disabled name={"src-create"}
                                           onInput={() => {
                                           }}/>
                                </div>
                                <p>
                                    Coming soon: create your own data source and add it to your calendar.
                                </p>
                            </label>
                            <div className={"space-between"} style={{width: "100%"}}>
                                <button onClick={() => document.querySelector("#source-list").close()}>Close</button>
                                <button onClick={() => window.location.href = "/docs/sources"} disabled>TODO: Learn more
                                </button>
                            </div>
                        </div>
                    </dialog>
                </div>
                <div className={"calendar-container"}>
                    <div className={"space-between"}>
                        <p>Calendar ID: <code>{calId}</code></p>
                        <h2>{calendar.name}</h2>
                        <div>
                            <button title={"Sync all"} style={{marginRight: "10px", backgroundColor: "#3136ed", color: "white", fontWeight: "bold"}}
                                    onClick={async () => {
                                        setSyncing(true);
                                        let res = await fetch("/api/calendar/" + calId + "/sync", {
                                            method: "POST"
                                        });
                                        let data = await res.json();
                                        if (res.ok && !data.error) {
                                            window.dispatchEvent(new Event("calendarUpdated"));
                                            window.displayMessage("Calendar synced successfully", "success");
                                        } else {
                                            window.displayMessage("Failed to sync calendar: " + (data.error || res.statusText), "error");
                                        }
                                        setSyncing(false);
                                    }} disabled={syncing}>
                                {syncing?"Syncing...":"Sync all"}
                            </button>
                            <button title={"Configuration"}
                                    onClick={() => document.querySelector("#options").showModal()}>Options️
                            </button>
                        </div>
                    </div>
                    <Calendar calendarId={calId}/>
                </div>
                <div className={"outputs"}>
                    <h3>Manage outputs</h3>
                    {calendar.outputs.map((s) => <div className={"output-settings"} data-output={s}>
                        <h4>{s}</h4>
                        {
                            outputs && outputs[s] ? <Output output={outputs[s]} calId={calId}/> : <div>Loading...</div>
                        }
                    </div>)}
                    <button title={"Add or remove outputs"}
                            onClick={() => document.querySelector("#output-list").showModal()}
                            style={{margin: "10px"}}>Add/Remove Outputs
                    </button>
                    <dialog id={"output-list"}>
                        <h2>Add or remove outputs</h2>
                        <div className={"flex-column"}>
                            {modules.available.outputs.length > 0 ? modules.available.outputs.map((s) => <>
                                <label className={"source"}>
                                    <div className={"space-between"}>
                                        <h5>{s.name}</h5>
                                        <input type={"checkbox"} onChange={async (e) => {
                                            let checked = e.target.checked;
                                            let outName = s.name;

                                            let newOutputs;
                                            // check if it is different from current state
                                            if (checked && !calendar.outputs.includes(outName)) {
                                                newOutputs = [...calendar.outputs, outName];
                                            } else if (!checked && calendar.outputs.includes(outName)) {
                                                newOutputs = calendar.outputs.filter((src) => src !== outName);
                                            }
                                            if (newOutputs) {
                                                let res = await fetch("/api/calendar/" + calId + "/output", {
                                                    method: "PUT",
                                                    headers: {
                                                        "Content-Type": "application/json"
                                                    },
                                                    body: JSON.stringify({outputs: newOutputs})
                                                });
                                                let data = await res.json();
                                                if (res.ok && !data.error) {
                                                    setCalendar({...calendar, outputs: newOutputs});
                                                    window.displayMessage("Outputs updated successfully", "success");
                                                } else {
                                                    window.displayMessage("Failed to update outputs: " + (data.error || res.statusText), "error");
                                                }
                                            }
                                        }
                                        } checked={calendar.outputs.includes(s.name)}/>
                                    </div>
                                    <p>
                                        {s.description}
                                    </p>
                                </label>
                            </>) : <p>No available outputs</p>}
                            <label className={"source disabled"}>
                                <div>
                                    <h5>iCal link</h5>
                                    <input type={"checkbox"} disabled name={"out-ical"}
                                           onInput={() => {
                                           }}/>
                                </div>
                                <p>
                                    Coming soon: get a link to your calendar that you can add to any calendar app that supports iCal
                                    format (Google Calendar, Apple Calendar, Outlook, etc.).
                                </p>
                            </label>
                            <div className={"space-between"} style={{width: "100%"}}>
                                <button onClick={() => document.querySelector("#output-list").close()}>Close</button>
                                <button onClick={() => window.location.href = "/docs/outputs"} disabled>TODO: Learn more
                                </button>
                            </div>
                        </div>
                    </dialog>
                </div>
            </div>

            <dialog id={"options"} style={{maxWidth: "600px", width: "90vw"}}>
                <h2>Options</h2>

                <div>
                    <label>
                        Calendar Name:
                        <input type={"text"} value={calendar.name} onChange={(e) => {
                            let newName = e.target.value;
                            setCalendar({...calendar, name: newName});
                        }} onBlur={async (e) => {
                            let newName = e.target.value;
                            let res = await fetch("/api/calendar/" + calId + "/rename", {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify({name: newName})
                            }).then(res => res.json());
                            if (res.error) {
                                window.displayMessage("Failed to rename calendar: " + res.error, "error");
                            } else {
                                window.displayMessage("Calendar renamed successfully", "success");
                            }
                        }}/>
                    </label>
                </div>

                <div className={"sync-info"}>
                    <h3>Generate synchronization script</h3>
                    <p>Create a task on your machine that will periodically sync the calendar</p>
                    <ScriptGenerator calendarId={calId}/>
                </div>

                <div className={"space-between"}>
                    <button onClick={() => {
                        localStorage.removeItem("current-calendar-id");
                        window.location.href = "/calendars";
                    }}>Switch Calendar
                    </button>

                    <button onClick={() => window.location.href = "/onboarding"}>Create New Calendar</button>
                    <button onClick={() => document.querySelector("#options").close()}>Close</button>
                </div>

                <div className={"space-between"} style={{marginTop: "30px", borderTop: "1px solid red", paddingTop: "10px"}}>
                    <strong>
                        Danger Zone
                    </strong>
                    <button onClick={async () => {
                        if (!confirm("Are you sure you want to delete this calendar? This action cannot be undone.")) {
                            return;
                        }
                        let res = await fetch("/api/calendar/" + calId, {
                            method: "DELETE"
                        }).then(res => res.json());
                        if (res.error) {
                            window.displayMessage("Failed to delete calendar: " + res.error, "error");
                        } else {
                            window.displayMessage("Calendar deleted successfully", "success");
                            localStorage.removeItem("current-calendar-id");
                            window.location.href = "/calendars";
                        }
                    }} style={{backgroundColor: "red", color: "white"}}>Delete Calendar
                    </button>
                </div>
            </dialog>
        </>
    )
}

export default Dashboard
