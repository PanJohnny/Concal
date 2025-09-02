import {useState} from "react";
import "./Onboarding.css";

function Onboarding() {
    let [phase, setPhase] = useState("initial");

    const phases = ["initial", "name", "sources", "outputs", "done"];
    let [phaseIndex, setPhaseIndex] = useState(0);

    let nextPhase = () => {
        setPhaseIndex(prevIndex => {
            let newIndex = prevIndex + 1;
            if (newIndex >= phases.length) {
                newIndex = phases.length - 1;
            }
            setPhase(phases[newIndex]);
            return newIndex;
        });
    };

    let previousPhase = () => {
        setPhaseIndex(prevIndex => {
            let newIndex = prevIndex - 1;
            if (newIndex <= 0) {
                newIndex = 0;
            }
            setPhase(phases[newIndex]);
            return newIndex;
        });
    };

    let [calendarName, setCalendarName] = useState("");

    let [sources, setSources] = useState([]);
    let [outputs, setOutputs] = useState([]);

    function toggleSource(source) {
        setSources(prevSources =>
            prevSources.includes(source)
                ? prevSources.filter(s => s !== source)
                : [...prevSources, source]
        );
    }

    function toggleOutput(output) {
        setOutputs(prevOutputs =>
            prevOutputs.includes(output)
                ? prevOutputs.filter(o => o !== output)
                : [...prevOutputs, output]
        );
    }

    function createCalendar() {
        const formData = {
            name: calendarName,
            sources: sources,
            outputs: outputs,
        };

        fetch('/api/calendar/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
        })
            .then(response => response.json())
            .then(data => {
                console.log('Success:', data);
                localStorage.setItem("current-calendar-id", data.id);
                window.location.href = "/dashboard";
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }

    return (
        <>
            <div className={["container", phase !== "initial" ? "hidden" : ""].join(" ")}>
                <h2>Welcome to Concal!</h2>
                <h3>First create new calendar</h3>
                <button onClick={nextPhase} type={"button"}>Create calendar</button>
            </div>
            <div className={["container", phase !== "name" ? "hidden" : ""].join(" ")}>
                <h2>Name your calendar</h2>
                <div>
                    <input type="text" name={"name"} placeholder="Calendar Name"
                           onChange={(e) => setCalendarName(e.target.value)}/>
                    <button onClick={nextPhase} type={"button"}>Next</button>
                </div>
            </div>
            <div className={["container", phase !== "sources" ? "hidden" : ""].join(" ")}>
                <h2>Add your data sources</h2>
                <label className={"source"}>
                    <div>
                        <h5>Bakaláři</h5>
                        <input type={"checkbox"} onInput={() => toggleSource("Bakaláři")}/>
                    </div>
                    <p>
                        Import your school schedule from Bakaláři. See your schedule, assignments, events and more in
                        one place.
                    </p>
                </label>
                <label className={"source disabled"}>
                    <div>
                        <h5>Create your own</h5>
                        <input type={"checkbox"} disabled name={"src-create"}
                               onInput={() => toggleSource("Create your own")}/>
                    </div>
                    <p>
                        Coming soon: create your own data source and add it to your calendar.
                    </p>
                </label>
                <div className={"space-between"}>
                    <button onClick={previousPhase} type={"button"}>Previous step</button>
                    <button onClick={nextPhase} type={"button"}>Next</button>
                </div>
            </div>
            <div className={["container", phase !== "outputs" ? "hidden" : ""].join(" ")}>
                <h2>Choose your output formats</h2>
                <label className={"source"}>
                    <div>
                        <h5>Google Calendar</h5>
                        <input type={"checkbox"} onInput={() => toggleOutput("Google Calendar")}/>
                    </div>
                    <p>
                        Sync your calendar directly with Google Calendar.
                    </p>
                </label>
                <label className={"source disabled"}>
                    <div>
                        <h5>iCal link</h5>
                        <input type={"checkbox"} disabled onInput={() => toggleOutput("iCal link")}/>
                    </div>
                    <p>
                        Coming soon: get a link to your calendar that you can add to any calendar app that supports iCal
                        format (Google Calendar, Apple Calendar, Outlook, etc.).
                    </p>
                </label>
                <div className={"space-between"}>
                    <button onClick={previousPhase} type={"button"}>Previous step</button>
                    <button onClick={nextPhase} type={"button"}>Finish</button>
                </div>
            </div>
            <div className={["container", phase !== "done" ? "hidden" : ""].join(" ")}>
                <h2>Summary for <strong>{calendarName}</strong></h2>
                <div className={"space-between gap"}>
                    <div className={"left"}>
                        <h3>Sources</h3>
                        <p>Selected data sources</p>
                        <ul>
                            {sources.map((source, idx) => (
                                <li key={idx}>{source}</li>
                            ))}
                        </ul>
                    </div>
                    <div className={"left"}>
                        <h3>Outputs</h3>
                        <p>Selected output formats</p>
                        <ul>
                            {outputs.map((output, idx) => (
                                <li key={idx}>{output}</li>
                            ))}
                        </ul>
                    </div>
                </div>
                <p>
                    You can edit these later on
                </p>
                <div className={"space-between"}>
                    <button type={"button"} onClick={previousPhase}>Previous step</button>
                    <button type={"button"} onClick={createCalendar}>Create calendar</button>
                </div>
            </div>
            <small hidden={phaseIndex < 1 || phaseIndex + 2 > phases.length}>
                Step {phaseIndex}/{phases.length - 2}
            </small>
        </>
    )
}

export default Onboarding
