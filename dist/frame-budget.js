// Streaming builders (terrain, fences, furniture, service lines, scenery chunks) each spend a few milliseconds of
// wall-clock time per frame while they have work queued. On a slow machine that is a fixed slice of an already long
// frame, so lower graphics tiers shrink every slice: scenery arrives a little later instead of the frame rate dropping.
// The builders also share one allowance per frame (beginStreamFrame): when several are busy at once, as after arriving
// somewhere dense, later ones get what is left rather than adding their full slices up, but never less than FLOOR_MS so
// none of them stalls. Without beginStreamFrame (tests, tools) each builder keeps its own slice.
// Import with the same specifier everywhere so every builder shares one scale and allowance.
const FLOOR_MS=.25;
let scale=1,deadline=Infinity;
export function setStreamBudgetScale(s){scale=s}
export function beginStreamFrame(ms=8){deadline=performance.now()+ms*scale}
export function streamBudget(ms){return Math.max(FLOOR_MS,Math.min(ms*scale,deadline-performance.now()))}
