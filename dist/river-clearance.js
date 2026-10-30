// Keep the entire crown footprint clear of mapped channels, not just the trunk.
export function vegetationClear(hydro,x,z,radius=0){return !hydro.nearChannel(x,z,radius+2)}
