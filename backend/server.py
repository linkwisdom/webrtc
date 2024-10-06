from flask import Flask
from flask_socketio import SocketIO, emit
from flask_cors import CORS

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

@socketio.on('connect')
def handle_connect():
    print('Client connected')

@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('offer')
def handle_offer(offer):
    print('Received offer')
    emit('offer', offer, broadcast=True, include_self=False)

@socketio.on('answer')
def handle_answer(answer):
    print('Received answer')
    emit('answer', answer, broadcast=True, include_self=False)

@socketio.on('ice-candidate')
def handle_ice_candidate(candidate):
    print('Received ICE candidate')
    emit('ice-candidate', candidate, broadcast=True, include_self=False)

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000)