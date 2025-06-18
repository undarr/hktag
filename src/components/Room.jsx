// src/components/Room.jsx
import React, { useState, useMemo } from 'react';
import PlayerListItem from './PlayerListItem';

const ROLES = ['Cop', 'Thief'];
const HONG_KONG_DISTRICTS = [
    "HKI Central and Western", "HKI Wan Chai", "HKI Eastern", "HKI Southern",
    "Kow Yau Tsim Mong", "Kow Sham Shui Po", "Kow Kowloon City", "Kow Wong Tai Sin", "Kow Kwun Tong",
    "NT Tsuen Wan", "NT Tuen Mun", "NT Yuen Long", "NT North", "NT Tai Po", "NT Sha Tin", "NT Sai Kung",
    "NT Islands", "NT Kwai Tsing"
];
const GAMEMODES = ['Classic']; //'Hide & Seek', 'Capture the Flag'

function Room({
  roomCode,
  playerName,
  players,
  myRole,
  myDistrict,
  isHost,
  isRoomLocked,
  gameMode,
  onUpdatePlayer,
  onHostAction,
  onLeaveRoom,
  refreshplayers
}) {
  const [selectedRole, setSelectedRole] = useState(myRole);
  const [selectedDistrict, setSelectedDistrict] = useState(myDistrict);

  // Convert players object to an array for sorting and easier iteration
  const playersArray = useMemo(() => {
    return Object.entries(players).map(([name, data]) => ({
      name,
      pin: data[0],
      timestamp: data[1],
      role: data[2],
      district: data[3], // Use mapped district for display
      fullDistrictName: data[3] // Keep full name for selection value
    }));
  }, [players]);

  // Determine the actual host based on earliest timestamp
  const currentHost = useMemo(() => {
    if (playersArray.length === 0) return null;
    return playersArray.reduce((prev, current) =>
      prev.timestamp < current.timestamp ? prev : current
    );
  }, [playersArray]);

  // Sort players: Me first, then teammates, then by time of joining
  const sortedPlayers = useMemo(() => {
    const myPlayer = playersArray.find(p => p.name === playerName);
    if (!myPlayer) {
      console.log("Shoulf left room")
      //onLeaveRoom(); // If my player object is gone, I've been kicked
      return [];
    }

    const teammates = playersArray
      .filter(p => p.name !== playerName && p.role === myPlayer.role)
      .sort((a, b) => a.timestamp - b.timestamp);

    const others = playersArray
      .filter(p => p.name !== playerName && p.role !== myPlayer.role)
      .sort((a, b) => a.timestamp - b.timestamp);

    return [myPlayer, ...teammates, ...others];
  }, [playersArray, playerName, myRole, onLeaveRoom]);

  // Calculate Cop and Thief counts
  const numCops = useMemo(() => playersArray.filter(p => p.role === 'Cop').length, [playersArray]);
  const numThieves = useMemo(() => playersArray.filter(p => p.role === 'Thief').length, [playersArray]);

  const handleRoleChange = (newRole) => {
    setSelectedRole(newRole);
    onUpdatePlayer(playerName, newRole, selectedDistrict);
  };

  const handleDistrictChange = (e) => {
    const newDistrict = e.target.value; // This will be the full district name
    setSelectedDistrict(newDistrict);
    onUpdatePlayer(playerName, selectedRole, newDistrict);
  };

  const handleKickPlayer = (targetPlayerName) => {
    if (window.confirm(`Are you sure you want to kick ${targetPlayerName}?`).toString()==="true") {
      onHostAction('kickPlayer', targetPlayerName);
    }
  };

  const handleAssignHost = (targetPlayerName) => {
    if (window.confirm(`Are you sure you want to assign host to ${targetPlayerName}?`).toString()==="true") {
      onHostAction('assignHost', targetPlayerName);
    }
  };

  const handleQuitRoom = () => {
    if (window.confirm("Are you sure you want to quit the room?").toString()==="true") {
      onLeaveRoom(players);
    }
  };

  // Function to render C/T with conditional styling
  const renderRoleCount = () => {
    const copChar = players[playerName][2] === 'Cop' ? <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>C</span> : 'C';
    const thiefChar = players[playerName][2] === 'Thief' ? <span style={{ textDecoration: 'underline', fontWeight: 'bold' }}>T</span> : 'T';

    return (
      <span className="player-count-display">
        ({numCops}{copChar} v {numThieves}{thiefChar})
      </span>
    );
  };

  return (
    <div className="container room-container">
      <div className="room-header">
        <div className="thirty">
        <h1>
          Room: {roomCode}
          <button className="refresh-button" onClick={refreshplayers}>⟳</button>
          <button className="quit-room-button" onClick={handleQuitRoom}>🚪</button>
        </h1>
        </div>
        <span className="game-title">Hong Kong Tag</span>
        <div className="thirty">
        <p className="room-status">
          {isRoomLocked ? '🔒' : '🔓'} | {gameMode} {/* Simplified text */}
        </p>
        </div>
      </div>

      <div className={`room-content-grid ${isHost ? 'host-layout' : 'player-layout'}`}>
        <div className="player-list-section">
          <div className="player-list-header">
            <h2>Players ({playersArray.length})</h2> {/* Changed to include player count */}
            {renderRoleCount()}
          </div>
          <ul className="player-list">
            {sortedPlayers.length === 0 ? (
              <p>No players in the room yet.</p>
            ) : (
              sortedPlayers.map((player) => (
                <PlayerListItem
                  key={player.name}
                  player={player}
                  isHost={player.name === currentHost?.name}
                  isMe={player.name === playerName}
                  showHostControls={isHost} // Pass down if current user is host
                  onKickPlayer={handleKickPlayer}
                  onAssignHost={handleAssignHost}
                />
              ))
            )}
          </ul>
        </div>

        <div className="my-settings-section">
          <div className="my-controls">
            <h3>My Settings</h3>
            <div className="form-group">
              <label>My Role:</label>
              <div className="role-selection-buttons">
                <button
                  className={`cop-button ${selectedRole === 'Cop' ? 'selected' : ''}`}
                  onClick={() => handleRoleChange('Cop')}
                >
                  Cop
                </button>
                <button
                  className={`thief-button ${selectedRole === 'Thief' ? 'selected' : ''}`}
                  onClick={() => handleRoleChange('Thief')}
                >
                  Thief
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="myDistrict">My Starting District:</label>
              <select id="myDistrict" value={selectedDistrict} onChange={handleDistrictChange} >
                {HONG_KONG_DISTRICTS.map(district => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isHost && (
          <div className="host-settings-section">
            <div className="host-controls">
              <h3>Host Controls</h3>
              <div className="form-group">
                <label htmlFor="gameModeSelect">Game Mode:</label>
                <select
                  id="gameModeSelect"
                  value={gameMode}
                  onChange={(e) => onHostAction('switchGamemode', e.target.value)}
                >
                  {GAMEMODES.map(mode => (
                    <option key={mode} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
              <div className="host-game-actions"> {/* New flex container for these buttons */}
                <button onClick={() => { console.log("Lock Room button clicked. Functionality disabled as per request."); }} disabled={true}>
                  Lock Room
                </button>
                <button onClick={() => onHostAction('startGame')} >
                  Start Game
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Room;