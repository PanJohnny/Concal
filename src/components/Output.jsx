import {useEffect, useState} from "react";

function Output({output, calId}) {
    // check authentication status if output.requireAuth is true and display login button if not authenticated
    let [authenticated, setAuthenticated] = useState(false);
    useEffect(() => {
        async function checkAuth() {
            if (output.requireAuth) {
                let res = await fetch(`/api/calendar/${calId}/output/${output.name}/authenticated`).then(res => res.json());
                setAuthenticated(res.authenticated);
            }
        }

        checkAuth();
    }, [output, calId]);

    let [isPushing, setIsPushing] = useState(false);
    // Funkce pro aktualizaci dat z kalendáře
    const pushCalendarData = async () => {
        setIsPushing(true);

        try {
            const response = await fetch(`/api/calendar/${calId}/output/${output.name}/push`, {
                method: 'POST'
            });
            const data = await response.json();

            if (!response.ok) {
                console.error("Failed to push calendar data", data.error);
                window.displayMessage(`Failed to update calendar: ${data.error}`, "error");
            }

            window.displayMessage("Calendar synchronized successfully", "success");
        } catch (error) {
            console.error("Error pulling calendar data:", error);
            window.displayMessage("Error pulling calendar data: " + error.message, "error");
        } finally {
            setIsPushing(false);
        }
    };
    return (
        <>
            <div className={"source-details"}>
                {output.requireAuth && !authenticated && <button className={"login-btn"} onClick={() => {
                    // open dialog with login type
                    let dialog = document.querySelector(`[data-output="${output.name}"] dialog[data-dialog="login"], [data-output="${output.name}"] dialog[data-dialog="oauth"]`);
                    if (dialog) {
                        dialog.showModal();
                    }
                }}>
                    {"Login"}
                </button>
                }
                {output.requireAuth && authenticated && <div className={"good-info"}>Authenticated</div> }
                <div className={"outputs-list"}>
                    {output.inputs?.map((output, idx) => (
                        <div key={idx} className={"output-info"}>
                            <strong>{output.name}</strong>
                            <div>Replace by: {output.replaceBy}</div>
                        </div>
                    ))}
                </div>
                <details>
                    <summary>Output detail (JSON)</summary>
                    <pre>{JSON.stringify(output, null, 2)}</pre>
                </details>
                {output.requireAuth && authenticated && <button className={"logout-btn"} onClick={async () => {
                    if (confirm("Are you sure you want to logout? This will remove all stored credentials for this output.")) {
                        let res = await fetch(`/api/calendar/${calId}/output/${output.name}/logout`, {
                            method: "POST"
                        }).then(res => res.json());
                        if (res.success) {
                            setAuthenticated(false);
                            window.displayMessage("Logged out", "info");
                        } else {
                            console.error("Error logging out: " + (res.error || "Unknown error"));
                            window.displayMessage("Error logging out: " + (res.error || "Unknown error"), "error");
                        }
                    }
                }} style={{backgroundColor: "red", margin: "10px"}}>Logout</button>}
                <button style={{backgroundColor:"yellow", margin: "10px", color: "black"}} onClick={pushCalendarData} disabled={isPushing}>
                    {isPushing ? "Pushing..." : "Push data"}
                </button>
            </div>
            {
                output.dialogs?.map((dialog, idx) => (
                    <dialog key={idx} className={"source-dialog"} onSubmit={
                        async (e) => {
                            // /api/calendar/:id/output/:name/submit/:idx  display result
                            e.preventDefault();
                            let formData = new FormData(e.target);
                            let data = {};
                            formData.forEach((value, key) => {
                                data[key] = value;
                            });

                            let fetchResult = await fetch(`/api/calendar/${calId}/output/${output.name}/submit/${idx}`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json"
                                },
                                body: JSON.stringify(data)
                            });

                            let result = await fetchResult.json();

                            if (fetchResult.ok) {
                                e.target.closest("dialog").close();
                                if (dialog.type === "oauth" && result.url) {
                                    window.displayMessage("Redirecting to OAuth provider...", "info");
                                    // redirect to url
                                    setTimeout(() => {
                                        window.location.href = result.url;
                                    }, 500)
                                } else {
                                    setAuthenticated(true);
                                    window.displayMessage("Logged in successfully", "success");
                                }
                            } else if (result.error) {
                                console.error("Error: " + result.error + (result.detail ? "\nDetails: " + result.detail : ""));
                                window.displayMessage("Error: " + result.error + (result.detail ? " - " + result.detail : ""), "error");
                            } else {
                                console.error("Unknown error");
                                window.displayMessage("Unknown error", "error");
                            }
                        }
                    } data-dialog={dialog.type}>
                        <h4>{dialog.name}</h4>
                        <form method="dialog">
                            {dialog.fields.map((field, fIdx) => (
                                <div key={fIdx} className={"form-field"}>
                                    <label>
                                        {field.label}
                                        <input
                                            type={field.type}
                                            name={field.name}
                                            placeholder={field.placeholder || ""}
                                            required={field.required || false}
                                        />
                                    </label>
                                </div>
                            ))}
                            <div className={"center-line"}>
                                <button type="submit">{dialog.submitLabel || "Submit"}</button>
                            </div>
                        </form>
                    </dialog>
                ))}
        </>
    );
}

export default Output;