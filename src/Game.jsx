// src/App.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, useMapEvents, Marker, Tooltip } from 'react-leaflet';
import './selfleaflet.css';
import L from 'leaflet';

// Helper component to access map instance for events
function MapEventHandler({ onMapClick }) {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng);
    },
  });
  return null;
}

/**
 * Performs a Breadth-First Search (BFS) starting from an edge, finding all edges
 * reachable within a given number of steps from either node of the starting edge.
 *
 * @param {Object.<string, string[]>} graph - A dictionary-like object where keys are node strings
 *                                            ('lat,lon') and values are arrays of connected node strings.
 * @param {[string, string]} startEdge - The starting edge as an array of two node strings.
 *                                       e.g., ["22.2941101,114.1683776", "22.2941766,114.1684527"]
 * @param {number} [maxSteps=8] - The maximum number of steps (depth) to explore from either start node.
 * @returns {Array<Array<[number, number]>>} - A list of edges, where each edge is an array of two
 *                                               coordinate arrays: [[lat1, lon1], [lat2, lon2]].
 */
function getReachableEdgesFromEdge(graph, startEdge, maxSteps = 8) {
    function parseNodeString(nodeString) {
      const parts = nodeString.split(',');
      return [parseFloat(parts[0]), parseFloat(parts[1])];
    }
    function getCanonicalEdgeString(nodeStr1, nodeStr2) {
      return [nodeStr1, nodeStr2].sort().join('|');
    }
    const reachableEdgesSet = new Set(); // Stores unique edges in canonical string form
    const visitedNodes = new Set();       // Stores unique visited node strings

    // Queue for BFS: stores objects of { node: string, depth: number }
    const queue = [];

    const startNode1 = startEdge[0].join(',');
    const startNode2 = startEdge[1].join(',');
    reachableEdgesSet.add(getCanonicalEdgeString(startNode1, startNode2));

    // Initialize BFS queue and visited set with both nodes of the starting edge
    if (graph.hasOwnProperty(startNode1)) {
        queue.push({ node: startNode1, depth: 0 });
        visitedNodes.add(startNode1);
    } else {
        console.warn(`Warning: Start node 1 '${startNode1}' from edge not found in the graph.`);
    }

    // Add startNode2 only if it's different from startNode1 and not already visited
    if (startNode1 !== startNode2 && graph.hasOwnProperty(startNode2)) {
        if (!visitedNodes.has(startNode2)) { // Check again in case startNode1 was added
            queue.push({ node: startNode2, depth: 0 });
            visitedNodes.add(startNode2);
        }
    } else if (!graph.hasOwnProperty(startNode2)) {
        console.warn(`Warning: Start node 2 '${startNode2}' from edge not found in the graph.`);
    }

    // If neither node of the start edge is in the graph, return empty
    if (queue.length === 0) {
        return [];
    }

    while (queue.length > 0) {
        const { node: currentNodeString, depth: currentDepth } = queue.shift(); // Dequeue

        // If we've reached or exceeded the maximum allowed steps,
        // do not explore further from this node.
        if (currentDepth >= maxSteps) {
            continue;
        }

        // Get neighbors of the current node. Use || [] to handle nodes with no defined neighbors.
        const neighbors = graph[currentNodeString] || [];

        for (const neighborNodeString of neighbors) {
            // Add the edge to our set of reachable edges
            reachableEdgesSet.add(getCanonicalEdgeString(currentNodeString, neighborNodeString));

            // If the neighbor hasn't been visited, add it to the queue for further exploration
            if (!visitedNodes.has(neighborNodeString)) {
                visitedNodes.add(neighborNodeString);
                queue.push({ node: neighborNodeString, depth: currentDepth + 1 });
            }
        }
    }

    // Convert the set of canonical edge strings back to the desired list of coordinate arrays
    const resultEdgesList = [];
    for (const edgeCanonicalString of reachableEdgesSet) {
        const [nodeStr1, nodeStr2] = edgeCanonicalString.split('|');
        const coord1 = parseNodeString(nodeStr1);
        const coord2 = parseNodeString(nodeStr2);
        resultEdgesList.push([coord1, coord2]);
    }

    return resultEdgesList;
}

function Game({starttime, roomCode, pname, allpdata, changemyedge, caughtlist}) {
  const myedge = [allpdata[pname][4]];
  const gamestarted = useRef(false);
  const [startoverlay, setstartoverlay] = useState(true);
  const [endoverlay, setendoverlay] = useState(false);
  const [timeleftuntilstart, settimeleftuntilstart] = useState('/');
  const strmyedge = JSON.stringify([allpdata[pname][4]]);
  const strcaughtlist = JSON.stringify(caughtlist);
  const myRole = [allpdata[pname][2]]
  const [curedge, setcuredge] = useState([allpdata[pname][4]]);
  //const curedgeref = useRef([[[22.3183395,114.1694384], [22.3175894,114.169594]]]);
  const [adjEdges, setadjEdges] = useState([]);
  const adjedgeref = useRef([]);
  const nxtedgeref = useRef([]);
  const directionref = useRef("/");
  const [headingdir, setheadingdir] = useState("/");
  const walkingstate = useRef("rest"); //rest, walk, wait (waiting for server)
  const [walktimestate, setwalktimestate] = useState("Resting...");
  const walktime = useRef(-1);
  const walktimeInterval = useRef(null);
  const [loadedEdges, setLoadedEdges] = useState([]);
  const loadedregionfile = useRef([]);
  const loadedregion = useRef([]);
  const [clickedLocation, setClickedLocation] = useState(null); // Stores the last clicked LatLng
  
  function plotbfs() {
    if (myedge[0] && myedge[0]!=="/") {
      const bSet = new Set(myedge.map(JSON.stringify));
      adjedgeref.current=getReachableEdgesFromEdge(loadedregion.current,myedge[0],1).filter(arr => !bSet.has(JSON.stringify(arr)));
      const bbSet = new Set(adjedgeref.current.map(JSON.stringify));
      getnextedge(myedge[0], adjedgeref.current, directionref.current);
      setLoadedEdges(getReachableEdgesFromEdge(loadedregion.current,myedge[0],20).filter(arr => !bSet.has(JSON.stringify(arr)) && !bbSet.has(JSON.stringify(arr))));
    }
  }

  // Effect to trigger data fetch when clickedLocation changes
  
  function walk() {
    walkingstate.current="wait";
    setwalktimestate("Arriving...");
    changemyedge(allpdata,nxtedgeref.current);
  }

  useEffect(() => {
    if (!walktimeInterval.current) {
        walktimeInterval.current=setInterval(()=>{
          if (gamestarted.current) { //ingame
            if (walkingstate.current==="walk") {
              if (walktime.current>0) {
                walktime.current=Math.round(walktime.current*10-1)/10;
                setwalktimestate("Travelling: "+(walktime.current).toString()+"s")
              }
              else {
                walk();
              }
            }
          }
          else {
            if (starttime!==0 && Date.now()>starttime) {
              gamestarted.current=true;
              setstartoverlay(false);
            }
            else {settimeleftuntilstart((Math.ceil((starttime-Date.now())/100))/10);}
          }
        },100)
      }
  }, []);

  useEffect(() => {
    async function yo() {
      if (myedge[0]) {
        console.log("myedgeupdated",myedge);
        setcuredge(myedge);
        await fetchRegionalData(myedge[0]);
        plotbfs();
        if (directionref.current==="/") {
          walkingstate.current="rest";
          setwalktimestate("Resting...");
        } else {
          getnextedge(myedge[0], adjedgeref.current, directionref.current);
          walkingstate.current="rest";
          handleEdgeClick(nxtedgeref.current);
        }
      }
      else {
        setcuredge([]);
        adjedgeref.current=[];
        setadjEdges([]);
        setLoadedEdges([]);
        setwalktimestate("Spectating...");
      }
      console.log()
    }
    yo();
  }, [strmyedge]);

  const playerstat = (playerList, caughtList) => {
    const cops = [];
    const thieves = [];

    // Categorize players and determine caught status for thieves
    Object.entries(playerList).forEach(([playerName, playerData]) => {
      const role = playerData[2]; // Role is at index 2
      if (role === "Cop") {
        cops.push({ name: playerName, role: "Cop" });
      } else if (role === "Thief") {
        const isCaught = caughtList[playerName][0] !== false;
        thieves.push({ name: playerName, role: "Thief", isCaught: isCaught });
      }
    });

    cops.sort((a, b) => a.name.localeCompare(b.name));
    thieves.sort((a, b) => {
      if (a.isCaught !== b.isCaught) {
        return a.isCaught ? 1 : -1; // If a is caught and b is not, a comes after b
      }
      return a.name.localeCompare(b.name);
    });

    const totalCops = cops.length;
    const totalThieves = thieves.length;
    const caughtThievesCount = thieves.filter(t => t.isCaught).length;
    const uncaughtThievesCount = totalThieves - caughtThievesCount;
    return (
      <>
        <b>Cops ({totalCops}/{totalCops}):</b><br />
        {cops.map((cop, index) => (
          <span key={cop.name}>{cop.name}<br /></span>
        ))}
        <br /> {/* Add a line break for separation */}
        <b>Thieves ({uncaughtThievesCount}/{totalThieves}):</b><br />
        {thieves.map((thief, index) => (
          <span key={thief.name}>
            {thief.isCaught ? <del>{thief.name}</del> : thief.name}
            <br />
          </span>
        ))}
      </>
    );
  };

  function summarize(starttime,d) {
  const summaryElements = Object.entries(d)
    .map(([thief, [catcher, caughtTime]]) => {
      const durationMs = caughtTime - starttime;
      const totalSeconds = Math.floor(durationMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      let timeParts = [];
      if (hours > 0) timeParts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
      if (minutes > 0 || hours > 0) timeParts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
      timeParts.push(`${seconds} second${seconds !== 1 ? 's' : ''}`);

      return {
        caughtTime: caughtTime,
        message1: thief,
        message2: catcher,
        message3: timeParts.join(', ')
      };
    })
    .sort((a, b) => a.caughtTime - b.caughtTime)
    .map((item, index) => (
      <span key={index}><b>{item.message1}</b> was caught by <b>{item.message2}</b> after {item.message3}</span>
    ));

  return (
    <>
      {summaryElements}
    </>
  );
};

  useEffect(() => {
    const caughtall = !Object.values(caughtlist).some(value => value[0] === false);
    if (caughtall) {setendoverlay(true); setwalktimestate("Spectating...");}
  }, [strcaughtlist]);

  useEffect(() => {setadjEdges(adjedgeref.current)}, [adjedgeref.current]);
  const center_lat = 22.3183395;
  const center_lon = 114.1694384;
  const initial_zoom = 15;
  const pressedKeys = useRef(new Set()); // Tracks currently pressed keys
  document.addEventListener('keydown', (event) => {
    pressedKeys.current.add(event.key.toLowerCase()); // Add the pressed key (normalized to lowercase)
    if (pressedKeys.current.has('w') && !pressedKeys.current.has('a') && !pressedKeys.current.has('d') && !pressedKeys.current.has('s')) {directionref.current="N";}
    else if (pressedKeys.current.has('w') && !pressedKeys.current.has('a') && pressedKeys.current.has('d') && !pressedKeys.current.has('s')) {directionref.current="NE";}
    else if (!pressedKeys.current.has('w') && !pressedKeys.current.has('a') && pressedKeys.current.has('d') && !pressedKeys.current.has('s')) {directionref.current="E";}
    else if (!pressedKeys.current.has('w') && !pressedKeys.current.has('a') && pressedKeys.current.has('d') && pressedKeys.current.has('s')) {directionref.current="SE";}
    else if (!pressedKeys.current.has('w') && !pressedKeys.current.has('a') && !pressedKeys.current.has('d') && pressedKeys.current.has('s')) {directionref.current="S";}
    else if (!pressedKeys.current.has('w') && pressedKeys.current.has('a') && !pressedKeys.current.has('d') && pressedKeys.current.has('s')) {directionref.current="SW";}
    else if (!pressedKeys.current.has('w') && pressedKeys.current.has('a') && !pressedKeys.current.has('d') && !pressedKeys.current.has('s')) {directionref.current="W";}
    else if (pressedKeys.current.has('w') && pressedKeys.current.has('a') && !pressedKeys.current.has('d') && !pressedKeys.current.has('s')) {directionref.current="NW";}
    if (event.key.toLowerCase()=="r") {directionref.current="/";}
    setheadingdir(directionref.current);
    getnextedge(myedge[0], adjedgeref.current, directionref.current);
    if (directionref.current!=="/") {
      handleEdgeClick(nxtedgeref.current);
    }

  });
  document.addEventListener('keyup', (event) => {
    pressedKeys.current.delete(event.key.toLowerCase()); // Remove the released key
  });

  function calculateDistance(edge) {
    const [lat1, lon1] = edge[0];
    const [lat2, lon2] = edge[1];
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // in metres
  }

  function calculateTraveltime(edge1,edge2) {
    const speed = 1; // meter/second
    return (Math.round(0.5*speed*(calculateDistance(edge1)+calculateDistance(edge2)))/10);
  }

  function calculateMidpoint(edge) {
    const [lat1, lon1] = edge[0];
    const [lat2, lon2] = edge[1];
    const toRad = (deg) => deg * Math.PI / 180;
    const toDeg = (rad) => rad * 180 / Math.PI;
    const φ1 = toRad(lat1);
    const λ1 = toRad(lon1);
    const φ2 = toRad(lat2);
    const λ2 = toRad(lon2);
    const Bx = Math.cos(φ2) * Math.cos(λ2 - λ1);
    const By = Math.cos(φ2) * Math.sin(λ2 - λ1);
    const latM = toDeg(Math.atan2(Math.sin(φ1) + Math.sin(φ2), Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By)));
    const lonM = toDeg(λ1 + Math.atan2(By, Math.cos(φ1) + Bx));
    return [latM, lonM];
  }

  function calculateBearing(node1, node2) {
    const [lat1, lon1] = node1;
    const [lat2, lon2] = node2;
    const toRad = (deg) => deg * Math.PI / 180;
    const toDeg = (rad) => rad * 180 / Math.PI;
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lon2 - lon1);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    let bearing = toDeg(Math.atan2(y, x));
    return((bearing + 360) % 360); // Normalize to 0-360
  }

  function getdiffwithbearing(trueBearing, direction) {
    const directions = { "N": 0, "NE": 45, "E": 90, "SE": 135, "S": 180, "SW": 225, "W": 270, "NW": 315 };
    const angle = directions[direction]
    trueBearing = (trueBearing % 360 + 360) % 360;
    let diff = Math.abs(trueBearing - angle);
    if (diff > 180) {
      diff = 360 - diff;
    }
    return diff;
  }

  function sortbybearing(startnode, endnode, direction) {
    return (getdiffwithbearing(calculateBearing(startnode, endnode), direction));
  }

  function getnextedge(curedge, adjedges, direction) {
    //console.log(curedge,adjedges,direction);
    if (direction=="/" || !curedge) {nxtedgeref.current="/"; return;}
    const midpt = calculateMidpoint(curedge);
    const startnode = curedge.sort((a, b) => (sortbybearing(midpt,a,direction) - (sortbybearing(midpt,b,direction))))[0]
    const nonstartnode = curedge.sort((a, b) => (sortbybearing(midpt,a,direction) - (sortbybearing(midpt,b,direction))))[1]
    const connectedNodes = adjedges.flatMap(edge => {
      const p1Str = JSON.stringify(edge[0]);
      const p2Str = JSON.stringify(edge[1]);
      const hasA = (p1Str === JSON.stringify(startnode) || p2Str === JSON.stringify(startnode));
      const hasB = (p1Str === JSON.stringify(nonstartnode) || p2Str === JSON.stringify(nonstartnode));
      if (hasA && !hasB) {
        if (p1Str === JSON.stringify(startnode)) return [edge[1]];
        if (p2Str === JSON.stringify(startnode)) return [edge[0]];
      }
      return [];
    });
    const sortednodes = connectedNodes.sort((a, b) => (sortbybearing(startnode,a,direction) - (sortbybearing(startnode,b,direction))))
    if (sortednodes.length>0 && sortbybearing(startnode,sortednodes[0],direction)<90) {
      nxtedgeref.current=[startnode,sortednodes[0]].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }
    else {
      const connectedNodes = adjedges.flatMap(edge => {
      const p1Str = JSON.stringify(edge[0]);
      const p2Str = JSON.stringify(edge[1]);
      const hasA = (p1Str === JSON.stringify(nonstartnode) || p2Str === JSON.stringify(nonstartnode));
      const hasB = (p1Str === JSON.stringify(startnode) || p2Str === JSON.stringify(startnode));
      if (hasA && !hasB) {
        if (p1Str === JSON.stringify(nonstartnode)) return [edge[1]];
        if (p2Str === JSON.stringify(nonstartnode)) return [edge[0]];
      }
        return [];
      });
      }
      const sortednodes2 = connectedNodes.sort((a, b) => (sortbybearing(startnode,a,direction) - (sortbybearing(startnode,b,direction))))
      if (sortednodes2.length>0 && sortbybearing(startnode,sortednodes[0],direction)<90) {
        nxtedgeref.current=[startnode,sortednodes2[0]].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      }
      else {
        nxtedgeref.current="/";
        directionref.current="/";
      }
  }

  // Function to fetch and process regional data
  async function fetchRegionalData(sedge) {
    if (sedge==="/") {return;}
    const getRegionFileName = (node) => {
      const [lat, lon] = node;
      const latPrefix = Math.floor(lat);
      const latSuffix = Math.floor((lat - latPrefix) * 100);
      const latz = latSuffix<10? "0" : "";
      const lonPrefix = Math.floor(lon);
      const lonSuffix = Math.floor((lon - lonPrefix) * 100);
      const lonz = lonSuffix<10? "0" : "";
      return `${latPrefix}a${latz}${latSuffix}b${lonPrefix}a${lonz}${lonSuffix}.txt`;
    };
    const [lat1, lon1] = sedge[0];
    const [lat2, lon2] = sedge[1];
    const coordinates = [
      [lat1 + 0.01, lon1 + 0.01],
      [lat1 + 0.01, lon1],
      [lat1 + 0.01, lon1 - 0.01],
      [lat1, lon1 + 0.01],
      [lat1, lon1],
      [lat1, lon1 - 0.01],
      [lat1 - 0.01, lon1 + 0.01],
      [lat1 - 0.01, lon1],
      [lat1 - 0.01, lon1 - 0.01],
      [lat2 + 0.01, lon2 + 0.01],
      [lat2 + 0.01, lon2],
      [lat2 + 0.01, lon2 - 0.01],
      [lat2, lon2 + 0.01],
      [lat2, lon2],
      [lat2, lon2 - 0.01],
      [lat2 - 0.01, lon2 + 0.01],
      [lat2 - 0.01, lon2],
      [lat2 - 0.01, lon2 - 0.01]
    ];
    const filenames = [...new Set(coordinates.map(getRegionFileName))];
    if (loadedregionfile.current!==filenames.sort().join("|")) {
      loadedregionfile.current=filenames.sort().join("|");
      console.log('refresh regional data');
      const fetchPromises = []; // Array to hold all fetch promises
      for (const filename of filenames) {
        const url = `/roadnodes/${filename}`;
        fetchPromises.push(
          fetch(url).then(res => res.text())
            .then(text => {
              if (text[0]==="<") {
                console.warn(`Received HTML error page for ${filename}. Skipping.`);
                return null; // Return null if it's an HTML error page
              }
              try {
                return JSON.parse(text); // Attempt to parse as JSON
              } catch (parseError) {
                console.error(`Error parsing JSON for ${filename}:`, parseError);
                return null; // Return null if JSON parsing fails
              }
            })
            .catch(err => {
              console.error(`Fetch or processing error for ${filename}:`, err);
              return null; // Return null for any other network or processing errors
            })
        );
      }
      // Await all promises in parallel. This is the "blocking" step.
      const results = await Promise.all(fetchPromises);
      const validRegionalData = results.filter(data => data !== null);
      const combinedNodeData = Object.assign({}, ...validRegionalData);
      loadedregion.current = combinedNodeData;
    }
  }

  const handleMapClick = useCallback((latlng) => {
    console.log("clickedmap",latlng);
  }, []);

  function handleEdgeClick(edge) {
    if (edge==="/") {return;}
    if (walkingstate.current!=="wait") {
      nxtedgeref.current=edge;
      walktime.current=calculateTraveltime(myedge[0],edge);;
      walkingstate.current="walk";
    }
  }

  const redDotIcon = L.divIcon({
    className: 'red-dot-icon', // Apply CSS class for styling
    html: '<div style="background-color: red; width: 10px; height: 10px; border-radius: 50%; border: 1px solid white;"></div>',
    iconSize: [12, 12], // Size of the icon (width, height)
    iconAnchor: [6, 6], // Point of the icon which will correspond to marker's location
  });

  const whiteDotIcon = L.divIcon({
    className: 'red-dot-icon', // Apply CSS class for styling
    html: '<div style="background-color: white; width: 10px; height: 10px; border-radius: 50%; border: 1px solid black;"></div>',
    iconSize: [12, 12], // Size of the icon (width, height)
    iconAnchor: [6, 6], // Point of the icon which will correspond to marker's location
  });

  const blackDotIcon = L.divIcon({
    className: 'red-dot-icon', // Apply CSS class for styling
    html: '<div style="background-color: black; width: 10px; height: 10px; border-radius: 50%; border: 1px solid white;"></div>',
    iconSize: [12, 12], // Size of the icon (width, height)
    iconAnchor: [6, 6], // Point of the icon which will correspond to marker's location
  });

  const mapBounds = [
    [22.1, 113.7], // South-West corner
    [22.6, 114.7]  // North-East corner
  ];

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <MapContainer
        center={[center_lat, center_lon]}
        zoom={initial_zoom}
        minZoom={11}
        maxZoom={20}
        scrollWheelZoom={true}
        maxBounds={mapBounds}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='© <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          minZoom={10}
          maxZoom={21}
        />

        {Object.keys(allpdata).filter(key => key !== pname && allpdata[key][4]!==false).map((key, index) => (
        <Marker key={index} position={calculateMidpoint(allpdata[key][4])} icon={allpdata[key][2] === "Thief" ? blackDotIcon : whiteDotIcon}>
        <Tooltip permanent direction="top" className="test">
          <p className={allpdata[key][2]}>{key}</p>
        </Tooltip>
        </Marker>))}

        {myedge[0] && <Marker position={calculateMidpoint(myedge[0])} icon={redDotIcon}>
        <Tooltip permanent direction="top" className="test">
          <p className={myRole}>{pname}</p>
        </Tooltip>
        </Marker>}

        {/* Component to handle map-level events */}
        <MapEventHandler onMapClick={handleMapClick} />

        {/* Render each loaded edge as a Polyline */}
        {curedge.map((edge, index) => (
          <Polyline
            key={JSON.stringify(edge) + index} // Unique key for each polyline
            positions={edge}
            pathOptions={{color: 'red', weight: 3, opacity: 0.7,}}
            eventHandlers={{
              click: () => handleEdgeClick(edge), // Pass the edge data and the Leaflet event object
            }}
          />
        ))}
        {adjEdges.map((edge, index) => (
          <Polyline
            key={JSON.stringify(edge) + index} // Unique key for each polyline
            positions={edge}
            pathOptions={{color: JSON.stringify(nxtedgeref.current)==JSON.stringify(edge) ? 'green' : 'yellow', weight: 3, opacity: 0.7,}}
            eventHandlers={{
              click: () => handleEdgeClick(edge), // Pass the edge data and the Leaflet event object
            }}
          />
        ))}
        {loadedEdges.map((edge, index) => (
          <Polyline
            key={JSON.stringify(edge) + index} // Unique key for each polyline
            positions={edge}
            pathOptions={{color: 'blue', weight: 3, opacity: 0.7,}}
            eventHandlers={{
              click: (e) => handleEdgeClick(edge), // Pass the edge data and the Leaflet event object
            }}
          />
        ))}
        <div style={{
          position: 'absolute', top: '10px', right: '10px', zIndex: 1000, color: '#000', textAlign: 'left',
          background: 'rgba(255, 255, 255, 0.8)', padding: '5px 10px', borderRadius: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}>
          <b>{pname}</b> ({myRole})<br/>
          Room: {roomCode}<br/>
          Heading: {headingdir}<br/>
          {walktimestate}<br/>
          <br/>
          {playerstat(allpdata,caughtlist)}
        </div>
      </MapContainer>
      {startoverlay && <div style={{
          position: 'absolute', top: '0px', right: '0px', width: '100%', height: '100%', zIndex: 1001, color: '#000', textAlign: 'center',
          background: 'rgba(255, 255, 255, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          Game will start at {new Date(starttime).toLocaleTimeString('en-US', { hour12: false })}<br></br>
          ({timeleftuntilstart} more seconds)
      </div>}
      {endoverlay && <div style={{
          position: 'absolute', top: '0px', right: '0px', width: '100%', height: '100%', zIndex: 1001, color: '#000', textAlign: 'center',
          background: 'rgba(255, 255, 255, 0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column'
        }}>
          Game over, all theives caught!<br></br>
          <br></br>
          <b>Summary:</b>
          {summarize(starttime,caughtlist)}
      </div>}
    </div>
  );
}

export default Game;