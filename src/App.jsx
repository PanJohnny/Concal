import {BrowserRouter, Routes, Route} from 'react-router-dom'
import Onboarding from './pages/Onboarding'
import Dashboard from "./pages/Dashboard.jsx";
import Calendars from "./pages/Calendars.jsx";
import {useEffect} from "react";

function App() {
    const query = new URLSearchParams(location.search);
    useEffect(() => {
        if (window.location.pathname === "/") {
            if (localStorage.getItem("current-calendar-id") !== null) {
                window.location.href = "/dashboard";
            }

            async function fetchCalendars() {
                let calendars = await fetch("/api/calendar/list").then(res => res.json());
                if (calendars.length === 0) {
                    window.location.href = "/onboarding";
                } else {
                    // redirect to the first calendar
                    localStorage.setItem("current-calendar-id", calendars[0].id);
                    window.location.href = "/dashboard";
                }
            }

            fetchCalendars();
        }

        window.displayMessage = function(message, type = "info") {
            let msgDiv = document.createElement("div");
            msgDiv.className = `message ${type}`;
            msgDiv.innerText = message;
            document.body.appendChild(msgDiv);
            setTimeout(() => {
                msgDiv.remove();
            }, 5000);
        };
    }, []);
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<div style={{position: "fixed", top: "50%", left: "50%"}}>Loading...</div>}/>
                <Route path="/onboarding" element={<Onboarding/>}/>
                <Route path="/dashboard" element={<Dashboard/>}/>
                <Route path="/calendars" element={<Calendars/>}/>
                <Route path="/oauth-fail" element={
                    <div style={{position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)"}}>
                        <h3>OAuth Login Failed</h3>
                        <p>There was an error during the OAuth login process. Please try again.</p>
                        <p>Reason: {query.has("error")?query.get("error"):"Unspecified"}</p>
                        <button onClick={() => window.location.href = "/dashboard"}>Go to Dashboard</button>
                    </div>
                }/>
            </Routes>
        </BrowserRouter>
    )
}

export default App
