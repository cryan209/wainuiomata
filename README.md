# Wainuiomata ’02
A browser-based PS2-inspired walking game. Serve `dist` over HTTP (for example `python3 -m http.server --directory dist`). No install or build required.

WASD/arrows move, mouse looks, Shift sprints, Escape pauses, R returns to Queen Street. Touch movement and drag-look are also available. Find four street markers.

Roads and building footprints are bundled from OpenStreetMap, town-centre bounding box 174.936,-41.265 to 174.948,-41.255. © OpenStreetMap contributors, ODbL https://www.openstreetmap.org/copyright . Building appearances and hills are procedural approximations, not a photogrammetric reconstruction. The game uses Three.js r160 (MIT).
