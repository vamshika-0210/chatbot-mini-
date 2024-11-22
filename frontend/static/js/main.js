// Add this at the top of the file
const GATEWAY_URL = window.CONFIG.GATEWAY_URL || 'http://localhost:5001';
const BACKEND_URL = 'http://localhost:5002';  // Updated to match the backend port

// Initialize Socket.IO connection
const socket = io();

// DOM Elements
const messagesContainer = document.getElementById('chat-messages');
const bookingDetails = document.getElementById('booking-details');
const bookingDate = document.getElementById('booking-date');
const bookingVisitors = document.getElementById('booking-visitors');
const bookingAmount = document.getElementById('booking-amount');
const paymentSection = document.getElementById('payment-section');
const proceedPaymentBtn = document.getElementById('proceed-payment');

// Booking state
let currentBooking = {
    date: null,
    nationality: null,
    adults: 0,
    children: 0,
    ticketType: null,
    timeSlot: null,
    amount: 0
};

// Connect to WebSocket
socket.on('connect', () => {
    console.log('Connected to server');
    showWelcomeMessage();
});

function showWelcomeMessage() {
    addMessage('Welcome to the Museum Ticket Booking System! How can I help you today?', 'bot');
    showInitialOptions();
}

function showInitialOptions() {
    const options = [
        { text: 'Book Tickets', icon: 'bi-ticket-perforated', action: 'start_booking' },
        { text: 'View Calendar', icon: 'bi-calendar3', action: 'show_calendar' },
        { text: 'Check Booking Status', icon: 'bi-search', action: 'check_status' }
    ];
    
    const quickReplies = document.createElement('div');
    quickReplies.className = 'quick-replies';
    
    options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'quick-reply-btn';
        button.innerHTML = `<i class="bi ${option.icon}"></i> ${option.text}`;
        button.onclick = () => handleInitialOption(option.action);
        quickReplies.appendChild(button);
    });
    
    messagesContainer.appendChild(quickReplies);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function handleInitialOption(action) {
    switch (action) {
        case 'start_booking':
            addMessage('Let\'s start your booking! First, please select a date for your visit.', 'bot');
            showCalendar();
            break;
        case 'show_calendar':
            addMessage('Here\'s our availability calendar:', 'bot');
            showCalendar();
            break;
        case 'check_status':
            showBookingStatus();
            break;
    }
}

// Handle incoming messages
socket.on('response', (data) => {
    addMessage(data.message, 'bot');
    
    if (data.action) {
        handleBotAction(data.action);
    }
});

socket.on('error', (data) => {
    addMessage('Sorry, an error occurred: ' + data.message, 'bot error');
});

// Handle bot actions
function handleBotAction(action) {
    switch (action) {
        case 'show_calendar':
            showCalendar();
            break;
        case 'select_nationality':
            showNationalityOptions();
            break;
        case 'select_visitors':
            showVisitorInputs();
            break;
        case 'select_time':
            showTimeSlots();
            break;
        case 'show_summary':
            updateBookingSummary();
            break;
    }
}

// Add message to chat
function addMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    
    // Check if message is HTML content
    if (typeof message === 'string' && message.trim().startsWith('<')) {
        bubble.innerHTML = message;
    } else {
        bubble.textContent = message;
    }
    
    messageDiv.appendChild(bubble);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Calendar functions
function showCalendar() {
    const calendarModal = document.getElementById('calendarModal');
    
    // Check if modal is already initialized
    let modal = bootstrap.Modal.getInstance(calendarModal);
    if (!modal) {
        modal = new bootstrap.Modal(calendarModal);
    }
    modal.show();
    
    // Create calendar UI
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = ''; // Clear existing content
    
    // Get current month and year from dataset or use current date as fallback
    const now = new Date();
    const currentMonth = parseInt(calendar.dataset.currentMonth) || now.getMonth();
    const currentYear = parseInt(calendar.dataset.currentYear) || now.getFullYear();
    
    // Store current month and year in dataset if not already set
    if (!calendar.dataset.currentMonth) {
        calendar.dataset.currentMonth = currentMonth;
    }
    if (!calendar.dataset.currentYear) {
        calendar.dataset.currentYear = currentYear;
    }
    
    // Create month selector
    const monthSelector = document.createElement('div');
    monthSelector.className = 'month-selector mb-3';
    monthSelector.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
            <button class="btn btn-outline-primary" onclick="changeMonth(-1)">Previous</button>
            <h4>${getMonthName(currentMonth)} ${currentYear}</h4>
            <button class="btn btn-outline-primary" onclick="changeMonth(1)">Next</button>
        </div>
    `;
    calendar.appendChild(monthSelector);
    
    // Create calendar grid
    createCalendarGrid(currentYear, currentMonth);
    fetchCalendarData(currentYear, currentMonth + 1);
}

function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month];
}

function createCalendarGrid(year, month) {
    const calendar = document.getElementById('calendar');
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Create weekday headers
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const grid = document.createElement('div');
    grid.className = 'calendar-grid';
    grid.innerHTML = `
        <style>
            .calendar-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 5px;
                text-align: center;
            }
            .calendar-day {
                padding: 10px;
                border: 1px solid #dee2e6;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                min-height: 70px;
            }
            .calendar-day .date {
                font-size: 1.1em;
                margin-bottom: 4px;
            }
            .calendar-day .slots {
                font-size: 0.8em;
                color: #666;
            }
            .calendar-day:hover {
                background-color: #f8f9fa;
            }
            .calendar-day.disabled {
                background-color: #e9ecef;
                cursor: not-allowed;
            }
            .calendar-day.available .slots {
                color: #28a745;
            }
            .calendar-day.limited .slots {
                color: #ffc107;
            }
            .calendar-day.full .slots {
                color: #dc3545;
            }
        </style>
    `;
    
    // Add weekday headers
    weekdays.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-header fw-bold';
        dayHeader.textContent = day;
        grid.appendChild(dayHeader);
    });
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day disabled';
        grid.appendChild(emptyDay);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.innerHTML = `
            <div class="date">${day}</div>
            <div class="slots"></div>
        `;
        dayCell.dataset.day = day;
        dayCell.onclick = () => selectDate(year, month + 1, day);
        dayCell.onmouseover = (e) => handleDateHover(e, `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        dayCell.onmouseout = () => {
            dayCell.classList.remove('show-tooltip');
            dayCell.removeAttribute('data-tooltip');
        };
        grid.appendChild(dayCell);
    }
    
    calendar.appendChild(grid);
}

function selectDate(year, month, day) {
    const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    currentBooking.date = dateStr;
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('calendarModal'));
    if (modal) {
        modal.hide();
        setTimeout(() => {
            addMessage(`You selected: ${dateStr}`, 'user');
            addMessage('Please select the number of visitors:', 'bot');
            showVisitorInputs();
        }, 300);
    }
}

function changeMonth(delta) {
    const calendar = document.getElementById('calendar');
    const currentMonth = parseInt(calendar.dataset.currentMonth) || new Date().getMonth();
    const currentYear = parseInt(calendar.dataset.currentYear) || new Date().getFullYear();
    
    let newMonth = currentMonth + delta;
    let newYear = currentYear;
    
    if (newMonth > 11) {
        newMonth = 0;
        newYear++;
    } else if (newMonth < 0) {
        newMonth = 11;
        newYear--;
    }
    
    calendar.dataset.currentMonth = newMonth;
    calendar.dataset.currentYear = newYear;
    
    calendar.innerHTML = '';
    showCalendar();
}

// Booking functions
function showNationalityOptions() {
    const options = ['Local', 'Foreign'];
    const quickReplies = document.createElement('div');
    quickReplies.className = 'quick-replies';
    
    options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'quick-reply-btn';
        button.textContent = option;
        button.onclick = () => selectNationality(option);
        quickReplies.appendChild(button);
    });
    
    messagesContainer.appendChild(quickReplies);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function selectNationality(nationality) {
    currentBooking.nationality = nationality;
    
    // Remove nationality options
    const quickReplies = document.querySelector('.quick-replies');
    if (quickReplies) {
        quickReplies.remove();
    }
    
    addMessage(`Selected nationality: ${nationality}`, 'user');
    addMessage('Please select your preferred ticket type:', 'bot');
    showTicketTypes();
}

function showVisitorInputs() {
    const inputs = document.createElement('div');
    inputs.className = 'visitor-inputs';
    inputs.innerHTML = `
        <div class="mb-3">
            <label>Adults:</label>
            <input type="number" min="1" value="1" class="form-control" id="adults-input">
        </div>
        <div class="mb-3">
            <label>Children:</label>
            <input type="number" min="0" value="0" class="form-control" id="children-input">
        </div>
        <button class="btn btn-primary" onclick="submitVisitors()">Continue</button>
    `;
    
    messagesContainer.appendChild(inputs);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function submitVisitors() {
    const adults = document.getElementById('adults-input').value;
    const children = document.getElementById('children-input').value;
    
    currentBooking.adults = parseInt(adults);
    currentBooking.children = parseInt(children);
    
    // Remove the visitor inputs
    const visitorInputs = document.querySelector('.visitor-inputs');
    if (visitorInputs) {
        visitorInputs.remove();
    }
    
    addMessage(`Selected visitors: ${adults} adults, ${children} children`, 'user');
    addMessage('Great! Now please select your nationality:', 'bot');
    showNationalityOptions();
}

function showTicketTypes() {
    const ticketTypes = ['regular'];  // Simplified to match our database
    const quickReplies = document.createElement('div');
    quickReplies.className = 'quick-replies';
    
    ticketTypes.forEach(type => {
        const button = document.createElement('button');
        button.className = 'quick-reply-btn';
        button.innerHTML = `<i class="bi bi-ticket-perforated"></i> ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        button.onclick = () => selectTicketType(type);
        quickReplies.appendChild(button);
    });
    
    messagesContainer.appendChild(quickReplies);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function selectTicketType(ticketType) {
    currentBooking.ticketType = ticketType;
    
    // Remove ticket type options
    const quickReplies = document.querySelector('.quick-replies');
    if (quickReplies) {
        quickReplies.remove();
    }
    
    addMessage(`Selected ticket type: ${ticketType}`, 'user');
    addMessage('Please select your preferred time slot:', 'bot');
    showTimeSlots();
}

function showTimeSlots() {
    const timeSlots = ['10:00', '14:00'];  // Match the database time slots
    const quickReplies = document.createElement('div');
    quickReplies.className = 'quick-replies';
    
    timeSlots.forEach(slot => {
        const button = document.createElement('button');
        button.className = 'quick-reply-btn';
        button.innerHTML = `<i class="bi bi-clock"></i> ${slot}`;
        button.onclick = () => selectTimeSlot(slot);
        quickReplies.appendChild(button);
    });
    
    messagesContainer.appendChild(quickReplies);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function selectTimeSlot(timeSlot) {
    currentBooking.timeSlot = timeSlot;  // No need for time conversion anymore
    
    // Remove time slot options
    const quickReplies = document.querySelector('.quick-replies');
    if (quickReplies) {
        quickReplies.remove();
    }
    
    addMessage(`Selected time slot: ${timeSlot}`, 'user');
    currentBooking.amount = (currentBooking.adults * 20) + (currentBooking.children * 10);
    
    addMessage('Great! Here\'s your booking summary:', 'bot');
    updateBookingSummary();
}

function updateBookingSummary() {
    if (currentBooking.date) {
        bookingDate.textContent = `Date: ${currentBooking.date}`;
        bookingVisitors.textContent = 
            `Visitors: ${currentBooking.adults} adults, ${currentBooking.children} children`;
        bookingAmount.textContent = `Total: $${currentBooking.amount}`;
        
        bookingDetails.classList.remove('d-none');
        if (currentBooking.amount > 0) {
            paymentSection.classList.remove('d-none');
        }
    }
}

// Payment handling
proceedPaymentBtn.addEventListener('click', async () => {
    try {
        proceedPaymentBtn.disabled = true;
        proceedPaymentBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Processing...';
        
        // Format the booking data correctly
        const bookingRequest = {
            date: currentBooking.date,
            nationality: currentBooking.nationality,
            adults: parseInt(currentBooking.adults),
            children: parseInt(currentBooking.children),
            ticketType: currentBooking.ticketType,
            timeSlot: currentBooking.timeSlot
        };
        
        console.log('Sending booking data:', bookingRequest); // Debug log
        
        // Create booking first
        const bookingResponse = await fetch(`${BACKEND_URL}/api/bookings/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bookingRequest)
        });
        
        if (!bookingResponse.ok) {
            const errorData = await bookingResponse.json();
            throw new Error(errorData.error || 'Failed to create booking');
        }
        
        const bookingResult = await bookingResponse.json();
        
        // Initialize payment
        const paymentResponse = await fetch(`${BACKEND_URL}/api/payments/initialize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                booking_id: bookingResult.booking_id,
                amount: currentBooking.amount,
                payment_method: 'card'
            })
        });
        
        if (!paymentResponse.ok) {
            throw new Error('Failed to initialize payment');
        }
        
        const paymentData = await paymentResponse.json();
        
        // For demo, simulate successful payment
        addMessage('Payment processed successfully! 🎉', 'bot');
        addMessage(`Your booking is confirmed. Booking ID: ${bookingResult.booking_id}`, 'bot');
        
        // Clear the current booking
        currentBooking = {
            date: null,
            nationality: null,
            adults: 0,
            children: 0,
            ticketType: null,
            timeSlot: null,
            amount: 0
        };
        
        // Hide booking summary and payment section
        bookingDetails.classList.add('d-none');
        paymentSection.classList.add('d-none');
        
        // Show initial options again
        showInitialOptions();
        
    } catch (error) {
        addMessage('Sorry, there was an error processing your booking: ' + error.message, 'bot');
    } finally {
        proceedPaymentBtn.disabled = false;
        proceedPaymentBtn.innerHTML = '<i class="bi bi-credit-card"></i> Proceed to Payment';
    }
});

// Booking status checker
async function showBookingStatus() {
    addMessage('Please enter your booking ID:', 'bot');
    
    // Create and show input form
    const inputForm = document.createElement('form');
    inputForm.className = 'booking-id-form';
    inputForm.innerHTML = `
        <div class="input-group mb-3">
            <input type="text" class="form-control" id="bookingIdInput" placeholder="Enter Booking ID" required>
            <button class="btn btn-primary" type="submit">Check Status</button>
        </div>
    `;
    
    inputForm.onsubmit = async (e) => {
        e.preventDefault();
        const bookingId = document.getElementById('bookingIdInput').value.trim();
        
        if (!bookingId) {
            addMessage('Please enter a valid booking ID.', 'bot');
            return;
        }
        
        try {
            const response = await fetch(`${BACKEND_URL}/api/bookings/${bookingId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.status === 'success') {
                displayBooking(data.data);
            } else {
                throw new Error(data.message || 'Failed to fetch booking');
            }
        } catch (error) {
            console.error('Error fetching booking:', error);
            addMessage('Sorry, we couldn\'t find a booking with that ID. Please check and try again.', 'bot');
        }
    };
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.appendChild(inputForm);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Focus on the input
    document.getElementById('bookingIdInput').focus();
}

// Display a single booking
function displayBooking(booking) {
    const formattedDate = new Date(booking.date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    // Create DOM elements instead of using template string
    const resultDiv = document.createElement('div');
    resultDiv.className = 'booking-result';

    const statusDiv = document.createElement('div');
    statusDiv.className = `booking-status-tag ${booking.status.toLowerCase()}`;
    statusDiv.textContent = booking.status;
    resultDiv.appendChild(statusDiv);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'booking-info';

    const timeDiv = document.createElement('div');
    timeDiv.className = 'booking-time';
    timeDiv.textContent = `${formattedDate} at ${booking.time_slot}`;
    infoDiv.appendChild(timeDiv);

    const visitorsDiv = document.createElement('div');
    visitorsDiv.className = 'booking-visitors';
    visitorsDiv.textContent = `${booking.adult_count + booking.child_count} Visitors`;
    infoDiv.appendChild(visitorsDiv);

    const amountDiv = document.createElement('div');
    amountDiv.className = 'booking-amount';
    amountDiv.textContent = `$${booking.total_amount}`;
    infoDiv.appendChild(amountDiv);

    resultDiv.appendChild(infoDiv);

    const referenceDiv = document.createElement('div');
    referenceDiv.className = 'booking-reference';
    referenceDiv.textContent = `Reference: ${booking.id.slice(0, 8)}`;
    resultDiv.appendChild(referenceDiv);

    // Create message container
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.appendChild(resultDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Add the necessary CSS if not already present
    if (!document.getElementById('booking-styles')) {
        const styles = document.createElement('style');
        styles.id = 'booking-styles';
        styles.textContent = `
            .booking-result {
                background: #f8f9fa;
                border-radius: 8px;
                padding: 16px;
                max-width: 400px;
            }
            .booking-status-tag {
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 0.9em;
                font-weight: 500;
                margin-bottom: 12px;
            }
            .booking-status-tag.confirmed {
                background: #e3f2fd;
                color: #1976d2;
            }
            .booking-status-tag.pending {
                background: #fff3e0;
                color: #f57c00;
            }
            .booking-status-tag.cancelled {
                background: #ffebee;
                color: #d32f2f;
            }
            .booking-info {
                margin: 12px 0;
            }
            .booking-time {
                font-size: 1.1em;
                font-weight: 500;
                margin-bottom: 8px;
            }
            .booking-visitors, .booking-amount {
                color: #666;
                font-size: 0.95em;
                margin: 4px 0;
            }
            .booking-reference {
                font-size: 0.85em;
                color: #888;
                margin-top: 12px;
            }
        `;
        document.head.appendChild(styles);
    }
}

// Fetch calendar data
async function fetchCalendarData(year, month) {
    try {
        console.log(`Fetching calendar data for ${year}/${month}`); // Debug log
        const response = await fetch(`${BACKEND_URL}/api/calendar/monthly/${year}/${month}`);
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch calendar data');
        }
        const data = await response.json();
        console.log('Calendar data received:', data); // Debug log
        renderCalendar(data);
    } catch (error) {
        console.error('Error fetching calendar data:', error);
        addMessage('Sorry, there was an error loading the calendar.', 'bot error');
    }
}

// Render calendar
function renderCalendar(data) {
    const calendar = document.getElementById('calendar');
    const grid = calendar.querySelector('.calendar-grid');
    
    if (!grid) return;
    
    // Clear existing availability classes
    grid.querySelectorAll('.calendar-day').forEach(cell => {
        cell.classList.remove('available', 'limited', 'full', 'unavailable');
    });
    
    // Add availability status
    Object.entries(data).forEach(([date, info]) => {
        const day = new Date(date).getDate();
        const dayCell = grid.querySelector(`.calendar-day[data-day="${day}"]`);
        if (dayCell) {
            dayCell.classList.add(info.status);
            
            // Calculate total available slots
            const totalAvailable = info.slots.reduce((sum, slot) => sum + slot.available, 0);
            
            // Update the slots display
            const slotsDiv = dayCell.querySelector('.slots');
            if (slotsDiv) {
                if (info.status === 'unavailable') {
                    slotsDiv.textContent = 'No slots';
                } else if (info.status === 'full') {
                    slotsDiv.textContent = 'Full';
                } else {
                    slotsDiv.textContent = `${totalAvailable} slots`;
                }
            }
            
            // Keep the tooltip for detailed slot information
            const slotsInfo = info.slots.map(slot => 
                `${slot.time}: ${slot.available} available`
            ).join('\n');
            dayCell.title = slotsInfo || 'No slots available';
        }
    });
}

// Add hover functionality to show remaining slots
async function handleDateHover(event, date) {
    const cell = event.target;
    
    try {
        const response = await fetch(`${BACKEND_URL}/api/bookings?date=${date}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data.status === 'success') {
            // Create tooltip content
            let tooltipContent = '<div class="slots-tooltip">';
            tooltipContent += '<h4>Available Slots:</h4>';
            
            Object.values(data.data.slots).forEach(slot => {
                tooltipContent += `<p>${slot.start_time} - ${slot.end_time}: ${slot.remaining}/${slot.capacity} slots</p>`;
            });
            
            tooltipContent += '</div>';
            
            // Show tooltip
            cell.setAttribute('data-tooltip', tooltipContent);
            cell.classList.add('show-tooltip');
        }
    } catch (error) {
        console.error('Error fetching slot information:', error);
    }
}
