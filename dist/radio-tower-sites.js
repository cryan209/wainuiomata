// Anchors: © OpenStreetMap contributors, ODbL. Geometry is an illustrative reconstruction.
export const RADIO_TOWER_SITES = [
  {
    "id": "fitzherbert",
    "name": "Mount Fitzherbert transmitter",
    "lat": -41.2184116,
    "lon": 174.9592245,
    "x": 1301.788,
    "z": -4809.14,
    "height": 46,
    "width": 7,
    "antenna": 7,
    "paint": "silver",
    "heightSource": "Approximate visual height; OSM does not specify height",
    "source": "https://www.openstreetmap.org/node/2392530592"
  },
  {
    "id": "victoria",
    "name": "Mount Victoria radio tower",
    "lat": -41.2960142,
    "lon": 174.7966281,
    "x": -12506.769,
    "z": 3511.948,
    "height": 50,
    "width": 8,
    "antenna": 10,
    "paint": "red-white",
    "heightSource": "Approximate visual height; OSM does not specify height",
    "source": "https://www.openstreetmap.org/node/296684884"
  },
  {
    "id": "kaukau",
    "name": "Mount Kaukau TV/FM tower",
    "lat": -41.2335243,
    "lon": 174.779377,
    "x": -13809.046,
    "z": -3455.543,
    "height": 122,
    "width": 22,
    "antenna": 22,
    "paint": "silver",
    "heightSource": "Pre-2022 mast height, matching the 2002 setting; OSM way 361818550",
    "source": "https://www.openstreetmap.org/way/361818550"
  }
];
export function radioTowerVegetationClear(x,z,radius=0){return RADIO_TOWER_SITES.every(s=>Math.hypot(x-s.x,z-s.z)>s.width*.7+radius+8)}
