// src/App.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import JoinRoomForm from './components/JoinRoomForm';
import Room from './components/Room';
import './index.css'; // Import global styles
import * as Ably from 'ably';
import Objects from 'ably/objects';
import Spaces from '@ably/spaces';
import Game from './Game';

function App() {
  const ABLY_API_KEY = 'VvlqqA.BMomiw:jgtZoDoPk4lUP57a6iu9YjPGxnYIVnGMB73gk_A3WUA';
  const [currentView, setCurrentView] = useState('join'); // 'join' or 'room'
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerPin, setPlayerPin] = useState('');
  const [myRole, setMyRole] = useState('Thief'); // Default role
  const [myDistrict, setMyDistrict] = useState('Kow Kowloon City'); // Default district
  const [gameState, setgameState] = useState('pre'); // Default district
  const [gamestarttime, setgamestarttime] = useState(0);
  const ablyRef = useRef(null);
  const channelRef = useRef(null);
  const channelgameRef = useRef(null);
  const rootobj = useRef(null);
  const playermapRef = useRef(null);
  const gamemapRef = useRef(null);
  const space = useRef(null);

  // Simulated backend state for players
  // Format: { "Player Name": [timestamp, "Role", "District"] }
  const [players, setplayers] = useState({});
  const [caughtlist, setcaughtlist] = useState({});
  //{"a":[1,"Cop","hi"],"aa":[12,"Thief","hi"],"aaa":[13,"Cop","hi"],"ad":[14,"Thief","hi"],"dda":[15,"Thief","hi"],"dad":[16,"Cop","hi"],"addd":[17,"Cop","hi"]}
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [gameMode, setGameMode] = useState('Classic');
  const [isLightMode, setIsLightMode] = useState(false); // State for theme toggle

  // Determine if the current player is the host
  const isHost = useMemo(() => {
    if (!playerName || Object.keys(players).length === 0) return false;
    const playersArray = Object.entries(players).map(([name, data]) => ({
      name,
      timestamp: data[1],
    }));
    const hostPlayer = playersArray.reduce((prev, current) =>
      prev.timestamp < current.timestamp ? prev : current
    );
    return hostPlayer.name === playerName;
  }, [players, playerName]);

  function toPdict(dataList) {
    const profileMap = {};
    dataList.forEach(item => {
      if (item.clientId && item.profileData) {
        profileMap[item.clientId] = item.profileData;
      }
    });
    return profileMap;
  }

  function upPdict(item) {
    //console.log('upd',item);
    setplayers((prevPlayers) => {
      const updatedPlayers = structuredClone(prevPlayers);
      updatedPlayers[item.clientId] = item.profileData;
      return updatedPlayers; // Return the new object
    });
  }

  function updatecaughtlist(cop,thief,time) {
    setcaughtlist((prevcaughtlist) => {
      const newcaughtlist = structuredClone(prevcaughtlist);
      newcaughtlist[thief] = [cop,time]
      return newcaughtlist;
    });
  }

  function rmPdict(item) {
    setplayers((prevPlayers) => {
    const newdict = Object.entries(prevPlayers).filter(([key, value]) => key!==item.clientId);
    return Object.fromEntries(newdict);
  });
  }

  // Function to handle joining the room
  async function handleJoinRoom({ roomCode, playerName, playerPin }) {
    setRoomCode(roomCode);
    setPlayerName(playerName);
    setPlayerPin(playerPin);
    let timenow = Date.now();
    let lastRole = myRole;
    let lastDistrict = myDistrict;
    try {
      async function joinroom() {
        ablyRef.current = new Ably.Realtime({ key: ABLY_API_KEY, clientId: playerName, plugins: { Objects }});
        ablyRef.current.connection.on('connected', () => {
          console.log('Ably Connected!');
        });
        ablyRef.current.connection.on('failed', (error) => {
          console.error('Ably Connection Failed:', error);
          alert('Failed to connect to Ably. Check your API key and network.');
        });
        channelRef.current = ablyRef.current.channels.get(`hsroom:${roomCode}`);
        await channelRef.current.attach();
        channelRef.current.subscribe((message) => {
          const data = JSON.parse(message.data)
          console.log('Received message:', message.name, message.data);
          if (message.name==="toHost" && data[0]===playerName) {
            space.current.updateProfileData(currentProfile => {
              const newP = [...currentProfile]
              newP[1] = data[1];
              return newP;
            });
          }
          else if (message.name==="kick" && data[0]===playerName) {
            handleLeaveRoom();
            alert('You have been kicked');
          }
          else if (message.name==="startgame") {
            setgamestarttime(data[0]);
            setplayers(data[1]);
            const mydata = data[1][playerName];
            setMyRole(mydata[2]);
            setMyDistrict(mydata[3]);
            playermapRef.current.set(playerName,JSON.stringify(mydata));
            Object.keys(data[1]).forEach(key => {
              if (data[1][key][2] === 'Thief') {
                updatecaughtlist(false,key,false);
              }
            });
            setgameState("on");
          }
          else if (message.name==="caught" || message.name==="selfcaught") {
            updatecaughtlist(data[0],data[1],data[2]);
            if (playerName===data[1] && message.name==="caught") {
              alert(`You are caught by ${data[0]} at ${new Date(data[2]).toLocaleTimeString('en-US', { hour12: false })}`);
              space.current.updateProfileData(currentProfile => {
                const newP = [...currentProfile]
                newP[4] = false;
                newP[5] = data[0];
                newP[6] = data[2];
                return newP;
              });  
            }
          }
        })
        channelgameRef.current = ablyRef.current.channels.get(`hsroomgame:${roomCode}`, { modes: ['OBJECT_PUBLISH', 'OBJECT_SUBSCRIBE'] });
        await channelgameRef.current.attach();
        rootobj.current = await channelgameRef.current.objects.getRoot();
        //rootobj.current.subscribe(({ update }) => {});
        const spaces = new Spaces(ablyRef.current, {offlineTimeout: 5000});
        space.current = await spaces.get(`hsroom:${roomCode}`);
        
        const spaceState = await space.current.getState();
        console.log(spaceState);
        const allmembers = await space.current.members.getOthers();
        const otherMembers = allmembers.filter(d => d.isConnected !== false);
        const cplayers = toPdict(otherMembers);
        if (cplayers[playerName]) {
          alert('A player with this name already exists in the room. Please choose another name.');
          disconnectably();
          return;
        }
        playermapRef.current = await rootobj.current.get("players");
        gamemapRef.current = await rootobj.current.get("game");
        //console.log(playermapRef.current, gamemapRef.current);
        if (!playermapRef.current) {
          console.log('create');
          playermapRef.current = await channelgameRef.current.objects.createMap();
          rootobj.current.set("players",playermapRef.current);
        }
        if (!gamemapRef.current) {
          gamemapRef.current = await channelgameRef.current.objects.createMap();
          rootobj.current.set("game",gamemapRef.current);
        }
        const gamestate = await gamemapRef.current.get('sstate');
        if (Object.keys(cplayers).length === 0) {
          console.log("No players, clear object cache");
          for (const key of playermapRef.current.keys()) {
            playermapRef.current.remove(key);
          }
          for (const key of gamemapRef.current.keys()) {
            gamemapRef.current.remove(key);
          }
          await playermapRef.current.set(playerName, JSON.stringify([playerPin, timenow, lastRole, lastDistrict, false, false, false]));
          await gamemapRef.current.set('sstate', 'pre');
        }
        else {

          if (gamestate==='on') {
            console.log("Game started");
            alert('Game in that room has started');
            disconnectably();
            return;
          }
          const playerCachedProfile = playermapRef.current.get(playerName);
          if (playerCachedProfile) {
            const parsedplayerCachedProfile = JSON.parse(playerCachedProfile);
            if (parsedplayerCachedProfile[0] === playerPin) {
              console.log("Retrieved cached data");
              timenow = parsedplayerCachedProfile[1];
              lastRole = parsedplayerCachedProfile[2];
              lastDistrict = parsedplayerCachedProfile[3];
              setMyRole(parsedplayerCachedProfile[2]);
              setMyDistrict(parsedplayerCachedProfile[3]);
            }
            else {
              console.log("Another player same name in cache");
              alert('A player with this name already exists in the room. Please choose another name.');
              disconnectably();
              return;
            }
          }
          else {
            console.log("No data in cache");
          }
        }
        space.current.enter([playerPin, timenow, lastRole, lastDistrict, true]).then(() => {
          space.current.members.subscribe(['leave'], (m) => {
            console.log('lr',m);
            rmPdict(m);
          });
          space.current.members.subscribe('updateProfile', (m) => {
            console.log('upProf',m);
            console.log(Date.now());
            upPdict(m);
            if (m.clientId === playerName && playermapRef.current) {
              playermapRef.current.set(playerName,JSON.stringify(m.profileData));
            }
          });
          cplayers[playerName] = [playerPin, timenow, lastRole, lastDistrict, false];
          console.log(cplayers);
          setplayers(cplayers);
          setCurrentView('room');
        })
        .catch((err) => {
        console.error('Error joining space:', err);
        });
      }
      joinroom();
    } catch (error) {
      console.error('Error connecting to Ably:', error);
      alert('Failed to connect to the room. See console for details.');
    }
  };

  // Function for a player to update their own role/district
  const handleUpdatePlayer = useCallback((name, newRole, newDistrict) => {
    console.log("local upd",Date.now());
    setMyRole(newRole);
    setMyDistrict(newDistrict);
    if (space.current) {
      space.current.updateProfileData(currentProfile => {
        const newP = [...currentProfile]
        newP[2] = newRole;
        newP[3] = newDistrict;
        return newP;
      });
    }
  }, [playerName]);

  function handlechangeedge(p,edge) {
    function getedgeString(edge) {
      return edge.sort().join('|');
    }
    function hascollide(e1,e2,r1,r2) {
      if (e1 && e2 && e1!=="/" && e2!=="/") {
        return (getedgeString(e1) === getedgeString(e2) && r1!==r2);
      }
      return false;
    }
    console.log("local upedge",Date.now())
    let catcher = false;
    let catchtime = false;
    if (space.current) {
      const collide = Object.keys(p).filter(key => hascollide(p[key][4],edge,p[key][2],myRole));
      console.log(p,collide);
      if (collide.length!==0) {
        console.log("collided");
        async function yo() {
          const newmembers = {};
          const allmembers = await space.current.members.getOthers();
          const members = allmembers.filter(d => d.isConnected !== false);
          members.forEach(m => newmembers[m.clientId]=m.profileData);
          const caughttime = Date.now();
          for (const collider of collide) {
            if (hascollide(newmembers[collider][4],edge,newmembers[collider][2],myRole)) {
              console.log("real collided");
              if (myRole==="Cop") {
                gamemapRef.current.set('palive'+collider, [true,playerName,caughttime]);
                channelRef.current.publish('caught',JSON.stringify([playerName,collider,caughttime]));
              }
              else if (myRole==="Thief") {
                gamemapRef.current.set('palive'+playerName, [true,collider,caughttime]);
                edge=false;
                catcher=collider;
                catchtime=caughttime;
                channelRef.current.publish('selfcaught',JSON.stringify([collider,playerName,caughttime]));
                alert(`You are caught by ${collider} at ${new Date(caughttime).toLocaleTimeString('en-US', { hour12: false })}`);
                break;
              }
            }
          }
        }
        yo();
      }
      space.current.updateProfileData(currentProfile => {
        const newP = [...currentProfile]
        newP[4] = edge;
        if (catcher) {newP[5] = catcher;}
        if (catchtime) {newP[6] = catchtime;}
        return newP;
      });   
    }
  }

  // Function for host actions
  const handleHostAction = useCallback((actionType, targetValue = null) => {
    if (!isHost) {
      alert("You are not the host!");
      return;
    }
    switch (actionType) {
      case 'startGame':
        const newmembers = {}
        const se = ([[[22.3175894,114.169594],[22.3183395,114.1694384]],
            [[22.3196071,114.1661712],[22.3196275,114.1661806]],
            [[22.3164005,114.1693374],[22.3164574,114.1696326]],
            [[22.311793,114.1698965],[22.3121526,114.1698236]],
            [[22.3150758,114.1669777],[22.3151372,114.1673161]],
            [[22.3117502,114.1697157],[22.3117836,114.1698981]]]).sort(() => Math.random() - 0.5);
        async function sg() {
          newmembers[playerName] = players[playerName]
          const allmembers = await space.current.members.getOthers();
          const members = allmembers.filter(d => d.isConnected !== false);
          members.forEach(m => newmembers[m.clientId]=m.profileData);
          const roles = Object.values(newmembers).map(v => v[2]);
          roles.includes("Cop") && roles.includes("Thief");
          if (!(roles.includes("Cop") && roles.includes("Thief"))) {
            alert("There must be at least 1 cop and 1 thief.");
          } else {
            const startedges = Object.fromEntries(Object.keys(newmembers).map((key, i) => [key, se[i]]));
            await gamemapRef.current.set('sstate', 'on');
            await gamemapRef.current.set('sstartedges', JSON.stringify(startedges));
            Object.keys(newmembers).forEach(async key => {
              newmembers[key][4] = startedges[key];
              if (newmembers[key][2] === 'Thief') {
                await gamemapRef.current.set('palive'+key, [true,false,false]);
              }
            });
            const starttime = Date.now()+5000;
            await gamemapRef.current.set('sstarttime', starttime);
            channelRef.current.publish('startgame',JSON.stringify([starttime,newmembers]));
          }
        }
        sg();
        break;
      case 'switchGamemode':
        setGameMode(targetValue); // targetValue is the new mode here
        break;
      case 'toggleLockRoom':
        setIsRoomLocked(prev => !prev);
        break;
      case 'assignHost':
        const targetPlayerName = targetValue;
        if (targetPlayerName && players[targetPlayerName]) {
          channelRef.current.publish('toHost',JSON.stringify([targetPlayerName, players[playerName][1]-1]));
          alert(`${targetPlayerName} is now the host!`);
        }
        break;
      case 'kickPlayer':
        const playerToKick = targetValue;
        if (playerToKick && players[playerToKick]) {
          channelRef.current.publish('kick',JSON.stringify([playerToKick]));
          alert(`${targetPlayerName} has been kicked!`);
        }
        break;
      default:
        console.warn('Unknown host action:', actionType);
    }
  }, [isHost, players, playerName]);

  function handleRefreshPlayers() {
    async function rp() {
      const allmembers = await space.current.members.getOthers();
      const members = allmembers.filter(d => d.isConnected !== false);
      console.log(members);
      const newmembers = {}
      newmembers[playerName] = players[playerName];
      members.forEach(m => newmembers[m.clientId]=m.profileData);
      setplayers(newmembers);
    }
    rp();
  }

  function disconnectably() {
    if (space.current) {
      console.log('Unsubscribing from channel and leaving presence...');
      space.current.unsubscribe();
      space.current = null;
    }
    if (ablyRef.current) {
      console.log('Closing Ably connection...');
      ablyRef.current.close();
      ablyRef.current = null;
    }
  }

  const handleLeaveRoom = useCallback(() => {
    console.log("handleLeaveRoomCalled");
    disconnectably();
    setplayers({});
    setCurrentView('join');
  }, []);

  // Effect to handle if the current player is kicked by the host
  useEffect(() => {
    if (currentView === 'room' && playerName && !players[playerName]) {
      handleLeaveRoom();
      alert("You have been kicked from the room.");
    }
  }, [players, playerName, currentView, handleLeaveRoom]);

  const toggleTheme = () => {
    setIsLightMode(prev => !prev);
  };

  return (
    <div className={isLightMode ? 'light-mode' : ''}> 
    {gameState==="on" && <Game
      starttime={gamestarttime}
      roomCode={roomCode}
      pname={playerName}
      allpdata={players}
      changemyedge={handlechangeedge}
      caughtlist={caughtlist}
    />}
    {gameState==="pre" &&
    <div className={`app-container ${isLightMode ? 'light-mode' : ''}`}>
      <button className="theme-toggle" onClick={toggleTheme}>
        {isLightMode ? '☀️' : '🌙'}
      </button>
      {currentView === 'join' ? (
        <JoinRoomForm onJoin={handleJoinRoom} />
      ) : (
        <Room
          roomCode={roomCode}
          playerName={playerName}
          players={players}
          myRole={myRole}
          myDistrict={myDistrict}
          isHost={isHost}
          isRoomLocked={isRoomLocked}
          gameMode={gameMode}
          onUpdatePlayer={handleUpdatePlayer}
          onHostAction={handleHostAction}
          onLeaveRoom={handleLeaveRoom}
          refreshplayers={handleRefreshPlayers}
        />
      )}

      <footer className="app-footer">
        Created by Undarfly Universe, Ulfred and Eric
      </footer>
    </div>
    }
    </div>
  );
}

export default App;