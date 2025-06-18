import re
import json
import os
from collections import defaultdict

# --- Configuration ---
INPUT_FILE = 'cways.txt'
OUTPUT_DIR = 'roadnodes'
# The precision for your grid squares (e.g., 0.01 for 2 decimal places)
GRID_PRECISION = 0.01

# --- Helper Functions ---

def parse_edge_line(line):
    """Parses a single line from cways.txt into two (lat, lon) tuples."""
    # Regex to capture four float numbers
    match = re.match(r'\[\((.+?), (.+?)\), \((.+?), (.+?)\)\]', line.strip())
    if match:
        lat1, lon1, lat2, lon2 = map(float, match.groups())
        return ((lat1, lon1), (lat2, lon2))
    return None

def get_region_key(lat, lon):
    """
    Calculates the floor of lat and lon to the nearest GRID_PRECISION.
    Returns a tuple (region_lat_floor, region_lon_floor).
    Example: (22.2941101, 114.1683776) -> (22.29, 114.16)
    """
    region_lat = int(lat / GRID_PRECISION) * GRID_PRECISION
    region_lon = int(lon / GRID_PRECISION) * GRID_PRECISION
    # Use round to handle potential floating point inaccuracies for display
    return (round(region_lat, 2), round(region_lon, 2))

def generate_filename(region_lat_floor, region_lon_floor):
    """
    Generates the filename based on the region key.
    Example: (22.29, 114.16) -> "22a29b114a16.txt"
    """
    lat_parts = f"{region_lat_floor:.2f}".split('.') # e.g., ['22', '29']
    lon_parts = f"{region_lon_floor:.2f}".split('.') # e.g., ['114', '16']

    # Ensure two digits for the fractional part, e.g., 22.05 -> 22a05
    lat_fraction = lat_parts[1] if len(lat_parts[1]) == 2 else f"{int(lat_parts[1]):02d}"
    lon_fraction = lon_parts[1] if len(lon_parts[1]) == 2 else f"{int(lon_parts[1]):02d}"

    return f"{lat_parts[0]}a{lat_fraction}b{lon_parts[0]}a{lon_fraction}.txt"

def node_to_string(node):
    """Converts a (lat, lon) tuple to a consistent string key."""
    return f"{node[0]},{node[1]}"

# --- Main Processing Logic ---

def process_cways_data():
    # Dictionary to hold data for each region:
    # { (region_lat_floor, region_lon_floor): { "node_str": ["connected_node_str", ...], ... }, ... }
    regions_data = defaultdict(lambda: defaultdict(list))

    print(f"Reading data from {INPUT_FILE}...")
    try:
        with open(INPUT_FILE, 'r') as f:
            for i, line in enumerate(f):
                edge = parse_edge_line(line)
                if edge:
                    node1, node2 = edge
                    node1_str = node_to_string(node1)
                    node2_str = node_to_string(node2)

                    # Get region for node1 and add node2 to its connections
                    region1_key = get_region_key(node1[0], node1[1])
                    regions_data[region1_key][node1_str].append(node2_str)

                    # Get region for node2 and add node1 to its connections
                    # (Edges are bidirectional)
                    region2_key = get_region_key(node2[0], node2[1])
                    regions_data[region2_key][node2_str].append(node1_str)
                else:
                    print(f"Warning: Could not parse line {i+1}: {line.strip()}")

                if (i + 1) % 100000 == 0:
                    print(f"Processed {i + 1} lines...")

    except FileNotFoundError:
        print(f"Error: Input file '{INPUT_FILE}' not found.")
        return

    print(f"Finished parsing {i+1} lines. Total unique regions found: {len(regions_data)}")
    print(f"Writing data to {OUTPUT_DIR} directory...")

    os.makedirs(OUTPUT_DIR, exist_ok=True) # Create output directory if it doesn't exist

    for region_key, nodes_in_region in regions_data.items():
        filename = generate_filename(region_key[0], region_key[1])
        filepath = os.path.join(OUTPUT_DIR, filename)

        # Remove duplicate connected nodes for each key node
        # Convert lists to sets and back to lists for uniqueness
        for node_str, connected_nodes_list in nodes_in_region.items():
            nodes_in_region[node_str] = sorted(list(set(connected_nodes_list))) # Sort for consistent output

        with open(filepath, 'w') as outfile:
            json.dump(nodes_in_region, outfile, indent=2) # Use indent for readability

    print(f"Processing complete. Files saved in '{OUTPUT_DIR}'.")

# --- Execute ---
if __name__ == "__main__":
    process_cways_data()