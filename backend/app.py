from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from datetime import datetime, timedelta
import os
from models import db, Booking, TimeSlot, Pricing, Payment
from dotenv import load_dotenv
import traceback

# Load environment variables
load_dotenv()

app = Flask(__name__, 
           static_folder='../frontend/static',
           static_url_path='/static',
           instance_path=os.path.join(os.getcwd(), 'instance'))
           
# Configure CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://127.0.0.1:5000", "http://localhost:5000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Configuration from environment
BACKEND_PORT = int(os.getenv('BACKEND_PORT', 5002))

# Configure Flask-SQLAlchemy
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('SQLALCHEMY_DATABASE_URI', 'sqlite:///instance/chatbot.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Ensure instance folder exists
os.makedirs('instance', exist_ok=True)

# Initialize extensions
db.init_app(app)
jwt = JWTManager(app)

def init_db():
    with app.app_context():
        db.create_all()
        
        # Add default pricing if Pricing table is empty
        if not Pricing.query.first():
            today = datetime.now().date()
            future_date = today + timedelta(days=365)  # Valid for one year
            
            default_pricing = [
                Pricing(
                    nationality='all',  # Default pricing for all nationalities
                    ticket_type='regular',
                    adult_price=20.00,
                    child_price=10.00,
                    effective_from=today,
                    effective_to=future_date
                )
            ]
            for price in default_pricing:
                db.session.add(price)
            db.session.commit()
            print("Default pricing initialized")
        
        # Add test data if TimeSlot table is empty
        if not TimeSlot.query.first():
            # Add time slots for the next 3 months
            current_date = datetime.now().date()
            end_date = current_date + timedelta(days=90)
            current = current_date
            
            while current <= end_date:
                # Morning slot
                morning_slot = TimeSlot(
                    date=current,
                    slot_time='10:00',
                    capacity=50,
                    booked_count=0,
                    ticket_type='regular'
                )
                # Afternoon slot
                afternoon_slot = TimeSlot(
                    date=current,
                    slot_time='14:00',
                    capacity=50,
                    booked_count=0,
                    ticket_type='regular'
                )
                db.session.add(morning_slot)
                db.session.add(afternoon_slot)
                current += timedelta(days=1)
            
            db.session.commit()
            print("Time slots initialized")

# Serve main HTML file
@app.route('/')
def serve_index():
    return send_from_directory('../frontend', 'index.html')

# Booking endpoints
@app.route('/api/bookings/availability/<date>', methods=['GET'])
def check_availability(date):
    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d').date()
        slots = TimeSlot.query.filter_by(date=date_obj).all()
        return jsonify([{
            'time': slot.slot_time,
            'available': slot.capacity - slot.booked_count,
            'ticket_type': slot.ticket_type
        } for slot in slots])
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/bookings/create', methods=['POST'])
def create_booking():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        print("Received booking data:", data)  # Debug log
            
        required_fields = ['date', 'nationality', 'adults', 'children', 'ticketType', 'timeSlot']
        missing_fields = [field for field in required_fields if field not in data]
        
        if missing_fields:
            return jsonify({'error': f'Missing required fields: {", ".join(missing_fields)}'}), 400
            
        booking_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        print("Booking date:", booking_date)  # Debug log
        
        # Check if the time slot exists and has capacity
        time_slot = TimeSlot.query.filter_by(
            date=booking_date,
            slot_time=data['timeSlot']
        ).first()
        
        if not time_slot:
            return jsonify({'error': 'Time slot not available'}), 400
        
        # Check capacity
        total_visitors = int(data['adults']) + int(data['children'])
        if time_slot.booked_count + total_visitors > time_slot.capacity:
            return jsonify({'error': 'Not enough capacity available'}), 400
        
        # Get pricing
        pricing_query = Pricing.query.filter(
            (Pricing.nationality == data['nationality']) | (Pricing.nationality == 'all'),
            Pricing.ticket_type == data['ticketType'],
            Pricing.effective_from <= booking_date,
            Pricing.effective_to >= booking_date
        )
        
        # Debug logs
        print("Looking for pricing with:")
        print(f"Nationality: {data['nationality']} or 'all'")
        print(f"Ticket type: {data['ticketType']}")
        print(f"Date range: {booking_date}")
        
        pricing = pricing_query.first()
        
        if not pricing:
            # Check what pricing entries exist
            all_pricing = Pricing.query.all()
            print("Available pricing entries:", [
                {
                    'nationality': p.nationality,
                    'ticket_type': p.ticket_type,
                    'effective_from': p.effective_from,
                    'effective_to': p.effective_to
                } for p in all_pricing
            ])
            return jsonify({'error': 'Pricing not found for the specified date and nationality'}), 400
        
        # Calculate total amount
        total_amount = (int(data['adults']) * pricing.adult_price) + (int(data['children']) * pricing.child_price)
        
        # Create the booking
        booking = Booking(
            date=booking_date,
            nationality=data['nationality'],
            adults=data['adults'],
            children=data['children'],
            ticket_type=data['ticketType'],
            time_slot=data['timeSlot'],
            total_amount=total_amount,
            status='pending'
        )
        
        # Update time slot capacity
        time_slot.booked_count += total_visitors
        
        db.session.add(booking)
        db.session.commit()
        
        return jsonify({
            'booking_id': booking.booking_id,
            'total_amount': total_amount,
            'status': 'success'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/bookings/<booking_id>', methods=['GET'])
def get_booking(booking_id):
    try:
        booking = Booking.query.filter_by(booking_id=booking_id).first()
        if not booking:
            return jsonify({
                'status': 'error',
                'message': 'Booking not found'
            }), 404
            
        return jsonify({
            'status': 'success',
            'data': {
                'id': booking.booking_id,
                'date': booking.date.strftime('%Y-%m-%d'),
                'time_slot': booking.time_slot,
                'adult_count': booking.adults,
                'child_count': booking.children,
                'total_amount': float(booking.total_amount),
                'status': booking.status.capitalize(),
                'payment_status': booking.payment_status
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 400

@app.route('/api/bookings', methods=['GET'])
def get_bookings():
    try:
        date_str = request.args.get('date')
        if date_str:
            # Convert string date to datetime
            date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            
            # Get all time slots for the date
            time_slots = TimeSlot.query.filter(
                db.func.date(TimeSlot.date) == date_obj
            ).all()
            
            # Get all bookings for the date - fixed field name from booking_date to date
            bookings = Booking.query.filter(
                db.func.date(Booking.date) == date_obj
            ).all()
            
            # Calculate remaining slots for each time slot
            slots_data = {}
            for slot in time_slots:
                # Fixed: Using time_slot field instead of time_slot_id
                slot_bookings = len([b for b in bookings if b.time_slot == slot.slot_time])
                slots_data[slot.id] = {
                    'start_time': slot.slot_time,
                    'end_time': (datetime.strptime(slot.slot_time, '%H:%M') + timedelta(hours=2)).strftime('%H:%M'),
                    'capacity': slot.capacity,
                    'remaining': slot.capacity - slot_bookings
                }
            
            return jsonify({
                'status': 'success',
                'data': {
                    'date': date_str,
                    'total_bookings': len(bookings),
                    'slots': slots_data
                }
            }), 200
        else:
            # Return all bookings if no date specified
            bookings = Booking.query.all()
            booking_list = []
            for booking in bookings:
                try:
                    booking_dict = booking.to_dict()
                    booking_list.append(booking_dict)
                except Exception as e:
                    print(f"Error converting booking {booking.id} to dict: {str(e)}")
                    continue
                    
            return jsonify({
                'status': 'success',
                'data': booking_list
            }), 200
            
    except Exception as e:
        error_traceback = traceback.format_exc()
        print(f"Error in get_bookings: {str(e)}")
        print(f"Traceback: {error_traceback}")
        return jsonify({
            'status': 'error',
            'message': str(e),
            'traceback': error_traceback if app.debug else None
        }), 500

@app.route('/api/bookings', methods=['GET'])
def get_user_bookings():
    try:
        # Get all bookings ordered by date
        bookings = Booking.query.order_by(Booking.date.desc()).all()
        
        bookings_data = []
        for booking in bookings:
            try:
                # Get associated time slot
                time_slot = TimeSlot.query.get(booking.time_slot_id)
                
                # Get associated payment
                payment = Payment.query.filter_by(booking_id=booking.id).first()
                
                # Get pricing info
                pricing = Pricing.query.filter_by(
                    nationality=booking.nationality,
                    ticket_type=booking.ticket_type
                ).first()
                
                # Calculate total amount
                adult_total = booking.adults * (pricing.adult_price if pricing else 0)
                child_total = booking.children * (pricing.child_price if pricing else 0)
                total_amount = adult_total + child_total
                
                booking_info = {
                    'id': booking.id,
                    'date': booking.date.strftime('%Y-%m-%d'),
                    'created_at': booking.created_at.strftime('%Y-%m-%d %I:%M %p'),
                    'nationality': booking.nationality,
                    'adults': booking.adults,
                    'children': booking.children,
                    'ticket_type': booking.ticket_type,
                    'time_slot': f"{time_slot.start_time.strftime('%I:%M %p')} - {time_slot.end_time.strftime('%I:%M %p')}" if time_slot else 'N/A',
                    'status': booking.status,
                    'payment_status': payment.status if payment else 'Not Initiated',
                    'payment_id': payment.payment_id if payment else None,
                    'total_amount': f"${total_amount:.2f}",
                    'pricing_details': {
                        'adult_price': f"${pricing.adult_price:.2f}" if pricing else 'N/A',
                        'child_price': f"${pricing.child_price:.2f}" if pricing else 'N/A',
                        'adult_total': f"${adult_total:.2f}",
                        'child_total': f"${child_total:.2f}"
                    }
                }
                bookings_data.append(booking_info)
            except Exception as e:
                print(f"Error processing booking {booking.id}: {str(e)}")
                continue
        
        return jsonify({'success': True, 'bookings': bookings_data})
    except Exception as e:
        print(f"Error fetching bookings: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to fetch bookings. Please try again later.'}), 500

# Payment endpoints
@app.route('/api/payments/initialize', methods=['POST'])
def initialize_payment():
    try:
        data = request.json
        booking = Booking.query.filter_by(booking_id=data['booking_id']).first()
        
        if not booking:
            return jsonify({'error': 'Booking not found'}), 404
            
        if booking.payment_status == 'completed':
            return jsonify({'error': 'Payment already completed'}), 400
            
        # Create payment record
        payment = Payment(
            booking_id=booking.booking_id,
            amount=data['amount'],
            payment_method=data['payment_method'],
            status='pending'
        )
        
        db.session.add(payment)
        db.session.commit()
        
        # For demo purposes, automatically mark payment as completed
        payment.status = 'completed'
        booking.payment_status = 'completed'
        booking.status = 'confirmed'
        db.session.commit()
        
        return jsonify(payment.to_dict())
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/api/payments/<payment_id>/status', methods=['GET'])
def get_payment_status(payment_id):
    try:
        payment = Payment.query.get(payment_id)
        if not payment:
            return jsonify({'error': 'Payment not found'}), 404
        return jsonify(payment.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Calendar endpoints
@app.route('/api/calendar/monthly/<year>/<month>', methods=['GET'])
def get_calendar_data(year, month):
    try:
        print(f"Backend: Processing calendar request for {year}/{month}")  # Debug log
        # Convert string parameters to integers if they aren't already
        year = int(year)
        month = int(month)
        
        # Get the first and last day of the month
        first_day = datetime(year, month, 1).date()
        if month == 12:
            last_day = datetime(year + 1, 1, 1).date() - timedelta(days=1)
        else:
            last_day = datetime(year, month + 1, 1).date() - timedelta(days=1)
        
        print(f"Backend: Fetching slots between {first_day} and {last_day}")  # Debug log
        
        # Get all time slots for the month
        slots = TimeSlot.query.filter(
            TimeSlot.date >= first_day,
            TimeSlot.date <= last_day
        ).all()
        
        print(f"Backend: Found {len(slots)} slots")  # Debug log
        
        # Create calendar data
        calendar_data = {}
        current_date = first_day
        while current_date <= last_day:
            day_slots = [s for s in slots if s.date == current_date]
            
            # Calculate availability
            if day_slots:
                total_capacity = sum(slot.capacity for slot in day_slots)
                total_booked = sum(slot.booked_count for slot in day_slots)
                availability = total_capacity - total_booked
                
                if availability == 0:
                    status = 'full'
                elif availability <= total_capacity * 0.2:  # Less than 20% available
                    status = 'limited'
                else:
                    status = 'available'
            else:
                status = 'unavailable'
            
            calendar_data[current_date.strftime('%Y-%m-%d')] = {
                'status': status,
                'slots': [{
                    'time': slot.slot_time,
                    'available': slot.capacity - slot.booked_count
                } for slot in day_slots]
            }
            current_date += timedelta(days=1)
        
        print("Backend: Calendar data prepared:", calendar_data)  # Debug log
        return jsonify(calendar_data)
    except Exception as e:
        print(f"Backend: Error processing calendar request - {str(e)}")  # Debug log
        return jsonify({'error': str(e)}), 400

# Add CORS headers here too
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

if __name__ == '__main__':
    init_db()
    app.run(port=BACKEND_PORT, debug=True)
