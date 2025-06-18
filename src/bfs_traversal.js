/**
 * Parses a node string "lat,lon" into a { lat: number, lon: number } object.
 * @param {string} nodeString - The node string (e.g., "22.2941101,114.1683776").
 * @returns {{lat: number, lon: number}} - The parsed coordinates.
 */
function parseNodeString(nodeString) {
    const parts = nodeString.replace('a','.').split(',');
    return {
        lat: parseFloat(parts[0]),
        lon: parseFloat(parts[1])
    };
}

/**
 * Formats a node object {lat, lon} back into a "lat,lon" string with fixed precision.
 * This is crucial for consistent file naming and content matching.
 * @param {{lat: number, lon: number}} node - The node object.
 * @returns {string} - The formatted node string.
 */

/**
 * Constructs the file path for a given node's adjacency list.
 * Assumes the 'node_files' directory is in the same location as this script.
 * @param {string} nodeString - The node string (e.g., "22.2941101,114.1683776").
 * @returns {string} - The relative path to the node's .txt file.
 */
function getNodeFilePath(nodeString) {
    const node = parseNodeString(nodeString);
    const latStr = node.lat.toFixed(7); // Use fixed precision for folder name consistency
    const folderName = latStr.substring(0, 6).replace('.','a'); // First 6 characters of latitude
    const fileName = `${nodeString}.txt`.replace(',','b');
    return `./db/roadnodes/${folderName}/${fileName}`;
}

/**
 * Reads the adjacency list for a given node from its corresponding .txt file.
 * @param {string} nodeString - The node string to fetch adjacencies for.
 * @returns {Promise<string[]>} - A promise that resolves to an array of neighbor node strings.
 */
async function readNodeAdjacencies(nodeString) {
    const filePath = getNodeFilePath(nodeString);
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            // If the file doesn't exist or other HTTP error
            if (response.status === 404) {
                // console.warn(`Node file not found for ${nodeString}: ${filePath}`);
            } else {
                console.error(`Error fetching ${filePath}: ${response.status} ${response.statusText}`);
            }
            return [];
        }
        const text = await response.text();
        // Split by newline and filter out empty lines
        return text.split('\n').map(line => line.trim()).filter(line => line !== '');
    } catch (error) {
        console.error(`Network or parsing error for ${nodeString} (${filePath}):`, error);
        return [];
    }
}

/**
 * Performs a Breadth-First Search (BFS) starting from a given node
 * until a maximum of `maxNodesToReach` unique nodes are visited.
 * Returns a list of edges encountered during the traversal.
 *
 * @param {string} startNodeString - The starting node as a string (e.g., "22.2940500,114.1685600").
 * @param {number} [maxNodesToReach=10] - The maximum number of unique nodes to visit.
 * @returns {Promise<string[][]>} - A promise that resolves to a list of edges,
 *                                  where each edge is [node1_string, node2_string].
 */
async function getEdgesByBFS(startNodeString, maxNodesToReach = 10) {
    const queue = [startNodeString];
    const visited = new Set(); // Stores visited node strings
    const edges = []; // Stores the resulting edges

    let nodesVisitedCount = 0;

    // Add the starting node to visited and count it
    if (!visited.has(startNodeString)) {
        visited.add(startNodeString);
        nodesVisitedCount++;
    }

    // BFS loop
    while (queue.length > 0 && nodesVisitedCount < maxNodesToReach) {
        const currentNodeString = queue.shift(); // Dequeue

        // Fetch neighbors for the current node
        const neighbors = await readNodeAdjacencies(currentNodeString);

        for (const neighborNodeString of neighbors) {
            if (!visited.has(neighborNodeString)) {
                // If this neighbor hasn't been visited yet
                
                // Add the edge to our result list
                edges.push([currentNodeString, neighborNodeString]);

                // Add neighbor to visited set and count it
                visited.add(neighborNodeString);
                nodesVisitedCount++;

                // Enqueue the neighbor for further exploration
                queue.push(neighborNodeString);

                // Check if we've reached our node limit after adding this new node
                if (nodesVisitedCount >= maxNodesToReach) {
                    // We've reached the limit, so we can stop adding more nodes to the queue
                    // and break out of the inner loop. The outer loop will then terminate.
                    break; 
                }
            }
        }
    }

    return edges;
}

console.log(getEdgesByBFS("22a2941101,114a1683776"));

// Export the function if this is an ES Module (e.g., for use with import)
//export { getEdgesByBFS };