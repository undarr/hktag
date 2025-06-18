// src/components/JoinRoomForm.jsx
import React, { useState } from 'react';

function JoinRoomForm({ onJoin }) {
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerPin, setPlayerPin] = useState('000'); // Prefilled with "000"
  const [errorMessage, setErrorMessage] = useState(''); // State for custom error message

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage(''); // Clear previous errors

    if (!roomCode || !playerName || !playerPin) {
      setErrorMessage('All fields are required.');
      return;
    }
    if (!/^\d{3}$/.test(playerPin)) {
      setErrorMessage('PIN must be a 3-digit number.');
      return;
    }
    setErrorMessage('Entering Room...');
    await onJoin({ roomCode, playerName, playerPin });
  };

  return (
    <div className="container join-form"> {/* Added join-form class for specific styling */}
      <h1>Hong Kong Tag</h1>
      {/* Removed <h2>Join Room</h2> as per request */}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="roomCode">Room Code:</label>
          <input
            type="text"
            id="roomCode"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="e.g., HKG123"
            maxLength="5" // Max 5 characters
          />
        </div>
        <div className="input-row"> {/* New flex container for name and pin */}
          <div className="form-group">
            <label htmlFor="playerName">Your Name:</label>
            <input
              type="text"
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g., John Doe"
              maxLength="10" // Max 10 characters
            />
          </div>
          <div className="form-group">
            <label htmlFor="playerPin">3-Digit PIN:</label>
            <input
              type="text"
              id="playerPin"
              value={playerPin}
              onChange={(e) => setPlayerPin(e.target.value)}
              maxLength="3"
              placeholder="e.g., 123"
            />
          </div>
        </div>
        {errorMessage && <p className="custom-alert">{errorMessage}</p>} {/* Custom alert display */}
        <button type="submit">Join Room</button>
      </form>
    </div>
  );
}

export default JoinRoomForm;