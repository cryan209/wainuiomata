import {cellSiteVegetationClear} from './cell-site-clearance.js?v=cells-90';
import {radioTowerVegetationClear} from './radio-tower-sites.js?v=towers-89';
import {lookoutVegetationClear} from './lookouts.js?v=radio-rain-88';
// Keep crown footprints clear of channels and the immediate lookout foreground.
export function vegetationClear(hydro,x,z,radius=0){return cellSiteVegetationClear(x,z,radius)&&radioTowerVegetationClear(x,z,radius)&&lookoutVegetationClear(x,z,radius)&&!hydro.nearChannel(x,z,radius+2)}
