import { useState, useEffect, useRef, useCallback } from 'react';
import './Calendar.css';

function Calendar({ calendarId }) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [events, setEvents] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [_isDialogOpen, setIsDialogOpen] = useState(false);
    const dialogRef = useRef(null);

    // Funkce pro získání rozsahu týdne
    const getWeekRange = useCallback((date) => {
        const currentDay = date.getDay();
        const adjustedCurrentDay = currentDay === 0 ? 6 : currentDay - 1; // Adjust for Monday start

        const startDate = new Date(date);
        startDate.setDate(date.getDate() - adjustedCurrentDay);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);

        return { startDate, endDate };
    }, []);

    // Funkce pro načtení událostí
    const fetchEvents = useCallback(async () => {
        if (!calendarId) return;

        setIsLoading(true);

        // Získat rozsah týdne
        const { startDate, endDate } = getWeekRange(currentDate);

        try {
            const response = await fetch(`/api/calendar/${calendarId}/events?startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch events');
            }

            setEvents(data);
        } catch (error) {
            console.error("Error fetching events:", error);
        } finally {
            setIsLoading(false);
        }
    }, [calendarId, currentDate, getWeekRange]);

    useEffect(() => {
        if (!calendarId) return;

        window.addEventListener("calendarUpdated", () => {
            fetchEvents();
        });
    }, [calendarId, fetchEvents]);

    // Načtení událostí při změně data nebo ID kalendáře
    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    // Získání dnů v aktuálním týdnu
    const getDaysInWeek = useCallback(() => {
        const { startDate } = getWeekRange(currentDate);
        const days = [];

        for (let i = 0; i < 7; i++) {
            const day = new Date(startDate);
            day.setDate(startDate.getDate() + i);

            // Najít události pro tento den
            const dayEvents = events.filter(event => {
                const eventStart = new Date(event.start_time);
                const eventDay = new Date(eventStart);
                eventDay.setHours(0, 0, 0, 0);

                const currentDay = new Date(day);
                currentDay.setHours(0, 0, 0, 0);

                return eventDay.getTime() === currentDay.getTime();
            });

            days.push({
                day: day.getDate(),
                date: new Date(day),
                events: dayEvents.map(event => ({
                    id: event.id,
                    title: event.title,
                    description: event.description || '',
                    location: event.location || '',
                    from: new Date(event.start_time),
                    to: new Date(event.end_time)
                }))
            });
        }

        return days;
    }, [currentDate, events, getWeekRange]);

    // Změna týdne
    const changeWeek = (increment) => {
        const newDate = new Date(currentDate);
        newDate.setDate(currentDate.getDate() + (increment * 7));
        setCurrentDate(newDate);
    };

    // Formátování rozsahu týdne
    const formatWeekRange = () => {
        const { startDate, endDate } = getWeekRange(currentDate);

        const formatOptions = { day: 'numeric', month: 'short' };
        const firstDayFormatted = startDate.toLocaleDateString('en-US', formatOptions);
        const lastDayFormatted = endDate.toLocaleDateString('en-US', formatOptions);

        return `${firstDayFormatted} - ${lastDayFormatted}`;
    };

    // Zpracování kliknutí na den
    const handleDayClick = (dayData) => {
        if (dayData.day) {
            setSelectedDate(dayData);
            setIsDialogOpen(true);
            if (dialogRef.current) {
                dialogRef.current.showModal();
            }
        }
    };

    // Zavření dialogu
    const closeDialog = () => {
        setIsDialogOpen(false);
        if (dialogRef.current) {
            dialogRef.current.close();
        }
    };

    // Formátování data pro dialog
    const formatDate = (date) => {
        if (!date) return '';
        return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };

    // Formátování času události
    const formatEventTime = (date) => {
        if (!date) return '';
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const days = getDaysInWeek();

    return (
        <div className="calendar">
            <div className="calendar-header">
                <button onClick={() => changeWeek(-1)}>&#8592;</button>
                <h3>{formatWeekRange()}</h3>
                <button onClick={() => changeWeek(1)}>&#8594;</button>
            </div>

            <div className="calendar-days-header">
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
                <div>Sun</div>
            </div>

            <div className="calendar-grid week-view">
                {days.map((day, index) => (
                    <div
                        key={index}
                        className={`calendar-day ${!day.day ? 'empty' : ''} ${
                            day.date &&
                            day.date.getDate() === new Date().getDate() &&
                            day.date.getMonth() === new Date().getMonth() &&
                            day.date.getFullYear() === new Date().getFullYear() ? 'today' : ''
                        }`}
                        onClick={() => handleDayClick(day)}
                    >
                        <div className="day-number">{day.day}</div>
                        <div className="day-events">
                            {isLoading ? (
                                <div className="loading">Loading...</div>
                            ) : (
                                day.events && day.events.map(event => (
                                    <div key={event.id} className="event-item" title={event.title}>
                                        <div className="event-time">{formatEventTime(event.from)}</div>
                                        <div className="event-title">{event.title}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <dialog ref={dialogRef} className="calendar-dialog">
                {selectedDate && (
                    <>
                        <div className="dialog-header">
                            <h3>{formatDate(selectedDate.date)}</h3>
                            <button onClick={closeDialog}>&times;</button>
                        </div>
                        <div className="dialog-content">
                            {selectedDate.events && selectedDate.events.length > 0 ? (
                                <div className="events-list">
                                    <h4>Events:</h4>
                                    {selectedDate.events.map(event => (
                                        <div key={event.id} className="event-item">
                                            <h5>{event.title}</h5>
                                            <div className="event-time">
                                                {formatEventTime(event.from)} - {formatEventTime(event.to)}
                                            </div>
                                            {event.location && <div className="event-location">Location: {event.location}</div>}
                                            {event.description && <p>{event.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p>No events for this day</p>
                            )}
                        </div>
                        <div className="dialog-footer">
                            <button onClick={closeDialog}>Close</button>
                        </div>
                    </>
                )}
            </dialog>
        </div>
    );
}

export default Calendar;