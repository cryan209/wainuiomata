// Streaming builders (terrain, fences, furniture, service lines, scenery chunks) each spend a few milliseconds of
// wall-clock time per frame while they have work queued. On a slow machine that is a fixed slice of an already long
// frame, so lower graphics tiers shrink every slice: scenery arrives a little later instead of the frame rate dropping.
// Import with the same specifier everywhere so every builder shares one scale.
let scale=1;
export function setStreamBudgetScale(s){scale=s}
export function streamBudget(ms){return ms*scale}
