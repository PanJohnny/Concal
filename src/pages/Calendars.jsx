import {useEffect, useState} from "react";
import "./Calendars.css";

function Calendars() {
    let [calendars, setCalendars] = useState([]);
    // fetch calendars from backend, useEffect on component mount
    useEffect(() => {
        async function fetchCalendars() {
            setCalendars(await fetch("/api/calendar/list").then(res => res.json()));
        }

        fetchCalendars();
    }, [setCalendars]);
    return (
        <>
            <h2>Select calendar to open it</h2>
            <div className={"calendar-list"}>
                {calendars && calendars.map((cal) => <div className={"calendar-item"} key={cal.id} onClick={() => {
                    localStorage.setItem("current-calendar-id", cal.id);
                    window.location.href = "/dashboard";
                }}>
                    <h3>{cal.name}</h3>
                    <p>Sources: {cal.sources.join(", ")}</p>
                    <p>Outputs: {cal.outputs.join(", ")}</p>
                </div>)}
                <button onClick={() => {
                    window.location.href = "/onboarding";
                }} style={{backgroundColor: "deepskyblue", color: "black", fontWeight: "bold"}}>Create new calendar</button>
            </div>
        </>
    )
}

export default Calendars
