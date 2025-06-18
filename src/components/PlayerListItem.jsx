// src/components/PlayerListItem.jsx
import React from 'react';

function PlayerListItem({ player, isHost, isMe, showHostControls, onKickPlayer, onAssignHost }) {
  const playerStyleClass = player.role === 'Cop' ? 'cop-style' : 'thief-style';
  const meClass = isMe ? 'me' : '';
  const districtMap = {
    "HKI Central and Western": "HKI CW", "HKI Wan Chai": "HKI WC", "HKI Eastern": "HKI EA", "HKI Southern": "HKI SO",
    "Kow Yau Tsim Mong": "Kow YTM", "Kow Sham Shui Po": "Kow SSP", "Kow Kowloon City": "Kow KC", "Kow Wong Tai Sin": "Kow WTS", "Kow Kwun Tong": "Kow KT",
    "NT Tsuen Wan": "NT TW", "NT Tuen Mun": "NT TM", "NT Yuen Long": "NT YL", "NT North": "NT NO", "NT Tai Po": "NT TP", "NT Sha Tin": "NT ST", "NT Sai Kung": "NT SK",
    "NT Islands": "NT IS", "NT Kwai Tsing": "NT KTS"
  };

  return (
    <li className={`player-item ${playerStyleClass} ${meClass}`}>
      <span className="player-name">
        {isHost && <span className="host-crown" title="Host">👑</span>}
        {player.name}
      </span>
      <span className="player-details">
        {districtMap[player.district]}
        {showHostControls && !isMe && ( // Only show if current user is host and not this player
          <>
            <button className="assign-host-button" onClick={() => onAssignHost(player.name)} title="Assign Host">
              👑
            </button>
            <button className="kick-button" onClick={() => onKickPlayer(player.name)} title="Kick Player">
              🦶
            </button>
          </>
        )}
      </span>
    </li>
  );
}

export default PlayerListItem;