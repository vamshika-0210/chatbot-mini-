from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration from environment
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-jwt-secret-key')
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5002')
GATEWAY_PORT = int(os.getenv('GATEWAY_PORT', 5001))

# Initialize extensions
jwt = JWTManager(app)
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Chat endpoint with rate limiting
@app.route('/api/chat/message', methods=['POST'])
@limiter.limit("10 per minute")
def handle_chat():
    try:
        message = request.json.get('message')
        # Process chat message and determine intent
        # This is a simple example - you would typically use a more sophisticated NLP service
        response = {
            'message': f"Received: {message}",
            'intent': 'booking',  # Simplified intent detection
            'next_action': 'show_calendar'
        }
        return jsonify(response)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Booking endpoints
@app.route('/api/bookings/availability/<date>', methods=['GET'])
def check_availability(date):
    try:
        response = requests.get(f"{BACKEND_URL}/api/bookings/availability/{date}")
        return jsonify(response.json()), response.status_code
    except requests.RequestException as e:
        return jsonify({'error': 'Backend service unavailable'}), 503

@app.route('/api/bookings/create', methods=['POST'])
def create_booking():
    try:
        print("Gateway: Received booking data:", request.json)  # Debug log
        response = requests.post(
            f"{BACKEND_URL}/api/bookings/create",
            json=request.json,
            headers={'Content-Type': 'application/json'}
        )
        if not response.ok:
            print(f"Gateway: Backend error - {response.status_code}")  # Debug log
            return jsonify(response.json()), response.status_code
        return jsonify(response.json()), response.status_code
    except requests.RequestException as e:
        print(f"Gateway: Request exception - {str(e)}")  # Debug log
        return jsonify({'error': 'Backend service unavailable'}), 503

@app.route('/api/bookings/<booking_id>', methods=['GET'])
def get_booking(booking_id):
    try:
        response = requests.get(f"{BACKEND_URL}/api/bookings/{booking_id}")
        return jsonify(response.json()), response.status_code
    except requests.RequestException as e:
        return jsonify({'error': 'Backend service unavailable'}), 503

# Calendar endpoints
@app.route('/api/calendar/monthly/<year>/<month>', methods=['GET'])
def get_calendar(year, month):
    try:
        print(f"Gateway: Fetching calendar for {year}/{month}")  # Debug log
        response = requests.get(
            f"{BACKEND_URL}/api/calendar/monthly/{year}/{month}",
            headers={'Content-Type': 'application/json'}
        )
        if not response.ok:
            print(f"Gateway: Backend error - {response.status_code}")  # Debug log
            error_data = response.json()
            return jsonify(error_data), response.status_code
            
        calendar_data = response.json()
        print("Gateway: Calendar data received:", calendar_data)  # Debug log
        return jsonify(calendar_data), response.status_code
    except requests.RequestException as e:
        print(f"Gateway: Request exception - {str(e)}")  # Debug log
        return jsonify({'error': 'Backend service unavailable'}), 503

# Payment endpoints
@app.route('/api/payments/initialize', methods=['POST'])
def initialize_payment():
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/payments/initialize",
            json=request.json
        )
        return jsonify(response.json()), response.status_code
    except requests.RequestException as e:
        return jsonify({'error': 'Backend service unavailable'}), 503

@app.route('/api/payments/<payment_id>/status', methods=['GET'])
def get_payment_status(payment_id):
    try:
        response = requests.get(
            f"{BACKEND_URL}/api/payments/{payment_id}/status"
        )
        return jsonify(response.json()), response.status_code
    except requests.RequestException as e:
        return jsonify({'error': 'Backend service unavailable'}), 503

# User session management
@app.route('/api/users/session', methods=['POST'])
def create_session():
    try:
        # Simple session creation - you would typically validate credentials here
        access_token = create_access_token(identity=request.json.get('user_id'))
        return jsonify({'token': access_token})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

# Add CORS headers to handle OPTIONS requests
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

if __name__ == '__main__':
    app.run(port=GATEWAY_PORT, debug=True)
