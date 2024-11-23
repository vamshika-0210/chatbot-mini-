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
    amount: 0,
    email: null
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

// Initialize calendar variables
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// Calendar functions
function showCalendar() {
    const calendarModal = document.getElementById('calendarModal');
    
    // Initialize modal if not already done
    let modal = bootstrap.Modal.getInstance(calendarModal);
    if (!modal) {
        modal = new bootstrap.Modal(calendarModal);
    }
    modal.show();
    
    // Create calendar UI
    const calendar = document.getElementById('calendar');
    calendar.innerHTML = '';
    
    // Create month selector
    const monthSelector = document.createElement('div');
    monthSelector.className = 'month-selector d-flex justify-content-between align-items-center mb-3';
    monthSelector.innerHTML = `
        <button class="btn btn-outline-primary" onclick="changeMonth(-1)">&lt; Prev</button>
        <h4>${getMonthName(currentMonth)} ${currentYear}</h4>
        <button class="btn btn-outline-primary" onclick="changeMonth(1)">Next &gt;</button>
    `;
    calendar.appendChild(monthSelector);
    
    // Create calendar grid
    const gridHtml = createCalendarGrid(currentYear, currentMonth);
    calendar.insertAdjacentHTML('beforeend', gridHtml);
    
    // Add click event listeners to all date cells
    calendar.querySelectorAll('td[data-date]').forEach(cell => {
        if (!cell.classList.contains('disabled')) {
            cell.addEventListener('click', () => {
                const dateStr = cell.getAttribute('data-date');
                if (dateStr) {
                    selectDate(dateStr);
                }
            });
        }
    });
    
    // Fetch and update availability data
    fetchCalendarData(currentYear, currentMonth + 1);
}

function getMonthName(month) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return months[month];
}

function createCalendarGrid(year, month) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const monthLength = lastDay.getDate();
    
    let html = '<table class="calendar table table-bordered">';
    html += '<thead><tr>';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
        html += `<th>${day}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    let day = 1;
    for (let i = 0; i < 6; i++) {
        html += '<tr>';
        for (let j = 0; j < 7; j++) {
            if (i === 0 && j < startingDay) {
                html += '<td></td>';
            } else if (day > monthLength) {
                html += '<td></td>';
            } else {
                const currentDate = new Date(year, month, day);
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                let classes = [];
                
                // Check if date is in the past
                if (currentDate < today) {
                    classes.push('past disabled');
                } else if (currentDate.getTime() === today.getTime()) {
                    classes.push('today');
                } else {
                    classes.push('future');
                }
                
                html += `<td class="${classes.join(' ')}" data-date="${dateStr}">${day}</td>`;
                day++;
            }
        }
        html += '</tr>';
        if (day > monthLength) {
            break;
        }
    }
    html += '</tbody></table>';
    return html;
}

function selectDate(dateStr) {
    if (!dateStr) return;
    
    currentBooking.date = dateStr;
    
    // Update UI to show selected date
    document.querySelectorAll('.calendar td').forEach(cell => {
        cell.classList.remove('selected');
    });
    
    const selectedCell = document.querySelector(`td[data-date="${dateStr}"]`);
    if (selectedCell) {
        selectedCell.classList.add('selected');
    }
    
    // Close calendar modal and proceed with booking
    const modal = bootstrap.Modal.getInstance(document.getElementById('calendarModal'));
    if (modal) {
        modal.hide();
    }
    
    // Display selected date in chat
    const formattedDate = new Date(dateStr).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    addMessage(`You selected: ${formattedDate}`, 'user');
    
    // Show nationality options
    showNationalityOptions();
}

function changeMonth(delta) {
    currentMonth += delta;
    
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    
    showCalendar();
}

// Booking functions
function showNationalityOptions() {
    const options = ['Local', 'Foreign', 'International'];  // Updated to match backend
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
    
    if (!adults || parseInt(adults) < 1) {
        addMessage('Please enter at least 1 adult', 'bot');
        return;
    }
    
    currentBooking.adults = parseInt(adults);
    currentBooking.children = parseInt(children);
    
    // Remove the visitor inputs
    const visitorInputs = document.querySelector('.visitor-inputs');
    if (visitorInputs) {
        visitorInputs.remove();
    }
    
    addMessage(`Selected visitors: ${adults} adults, ${children} children`, 'user');
    addMessage('Please enter your email address for booking confirmation:', 'bot');
    
    const emailInput = document.createElement('div');
    emailInput.className = 'email-input-container';
    emailInput.innerHTML = `
        <input type="email" id="visitor-email" class="form-control" placeholder="Enter your email">
        <button onclick="submitEmail()" class="btn btn-primary mt-2">Submit</button>
    `;
    messagesContainer.appendChild(emailInput);
    document.getElementById('visitor-email').focus();
}

function showTicketTypes() {
    const ticketTypes = ['Regular'];  // Updated to match backend
    const quickReplies = document.createElement('div');
    quickReplies.className = 'quick-replies';
    
    ticketTypes.forEach(type => {
        const button = document.createElement('button');
        button.className = 'quick-reply-btn';
        button.innerHTML = `<i class="bi bi-ticket-perforated"></i> ${type}`;
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
    const timeSlots = ['10:00 AM', '2:00 PM'];  // Updated to match backend
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
    addMessage('Please enter the number of visitors:', 'bot');
    showVisitorInputs();
}

function submitEmail() {
    const emailInput = document.getElementById('visitor-email');
    const email = emailInput.value.trim();
    
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        addMessage('Please enter a valid email address.', 'bot');
        return;
    }
    
    currentBooking.email = email;
    addMessage(`Email: ${email}`, 'user');
    emailInput.parentElement.remove();
    
    // Show booking summary and payment options
    currentBooking.amount = (currentBooking.adults * 20) + (currentBooking.children * 10);
    
    addMessage('Great! Here\'s your booking summary:', 'bot');
    updateBookingSummary();
    addMessage('Great! Please review your booking details and proceed to payment.', 'bot');
    paymentSection.classList.remove('d-none');
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
        addMessage('Processing your booking...', 'bot');

        // Validate booking data
        const requiredFields = ['date', 'nationality', 'adults', 'children', 'ticketType', 'timeSlot', 'email'];
        const missingFields = requiredFields.filter(field => !currentBooking[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Create booking
        const bookingData = {
            date: currentBooking.date,
            nationality: currentBooking.nationality,
            adults: parseInt(currentBooking.adults),
            children: parseInt(currentBooking.children),
            ticketType: currentBooking.ticketType,
            timeSlot: currentBooking.timeSlot,
            email: currentBooking.email
        };

        console.log('Sending booking data:', bookingData);  // Debug log

        const response = await fetch(`${BACKEND_URL}/api/bookings/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(bookingData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create booking');
        }
        
        const data = await response.json();
        
        if (!data.booking_id) {
            throw new Error('Invalid booking response');
        }

        // Initialize payment
        const paymentResponse = await fetch(`${BACKEND_URL}/api/payments/initialize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                booking_id: data.booking_id,
                amount: data.amount,
                payment_method: 'card'  // Added default payment method
            })
        });

        if (!paymentResponse.ok) {
            const errorData = await paymentResponse.json();
            throw new Error(errorData.error || 'Failed to initialize payment');
        }
        
        const paymentData = await paymentResponse.json();
        
        // For demo, simulate successful payment
        addMessage('Payment processed successfully! ', 'bot');
        addMessage(`Your booking is confirmed. Booking ID: ${data.booking_id}`, 'bot');
        
        // Clear the current booking
        currentBooking = {
            date: null,
            nationality: null,
            adults: 0,
            children: 0,
            ticketType: null,
            timeSlot: null,
            amount: 0,
            email: null
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
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data.status === 'success') {
                throw new Error(data.message || 'Failed to fetch booking');
            }
            
            displayBooking(data.data);
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
    try {
        const response = await fetch(`${BACKEND_URL}/api/bookings?date=${date}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.slots || !Array.isArray(data.slots)) {
            throw new Error('Invalid response format');
        }
        
        // Create tooltip content
        const tooltipContent = data.slots.map(slot => 
            `${slot.time}: ${slot.available} available (${slot.ticket_type})`
        ).join('\n');
        
        // Update the tooltip
        event.target.title = tooltipContent || 'No slots available';
        
        // Update slot count display
        const slotsDiv = event.target.querySelector('.slots');
        if (slotsDiv) {
            const totalAvailable = data.slots.reduce((sum, slot) => sum + slot.available, 0);
            if (totalAvailable === 0) {
                slotsDiv.textContent = 'Full';
                event.target.classList.remove('available', 'limited');
                event.target.classList.add('full');
            } else if (totalAvailable < 5) {
                slotsDiv.textContent = `${totalAvailable} slots`;
                event.target.classList.remove('available', 'full');
                event.target.classList.add('limited');
            } else {
                slotsDiv.textContent = `${totalAvailable} slots`;
                event.target.classList.remove('limited', 'full');
                event.target.classList.add('available');
            }
        }
    } catch (error) {
        console.error('Error fetching slot information:', error);
        event.target.title = 'Error loading slot information';
    }
}

async function createBooking(bookingData) {
    try {
        console.log('Sending booking data:', bookingData);
        
        const response = await fetch(`${BACKEND_URL}/api/bookings/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(bookingData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create booking');
        }

        const data = await response.json();
        
        if (!data.booking_id) {
            throw new Error('Invalid booking response');
        }

        // Show success message
        addMessage('Booking successful! Check your email for confirmation.', 'bot');
        return data;
    } catch (error) {
        console.error('Error creating booking:', error);
        addMessage(`Sorry, there was an error processing your booking: ${error.message}`, 'bot');
        throw error;
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    messagesContainer.appendChild(errorDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
