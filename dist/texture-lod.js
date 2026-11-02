import * as T from './vendor/three.js';
// The large single photographs (roof aerials, regional ground overviews) also ship at half and quarter resolution as
// '<name>-half.webp' and '<name>-quarter.webp' (scripts/make_photo_levels.sh). Lower graphics tiers use those: each step
// down is a quarter of the download, decode, GPU memory and upload. Changing tier swaps each photo inside its existing texture, so materials and shader uniforms
// keep working. Import with the same specifier everywhere so every photo shares one level.
let level='full';const photos=[];
const urlFor=(url,l)=>l==='full'?url:url.replace(/\.webp$/,`-${l}.webp`);
export function setPhotoDetail(next){if(next===level)return;level=next;for(const p of photos)swap(p)}
export async function loadLodPhoto(url){const l=level,texture=await new T.TextureLoader().loadAsync(urlFor(url,l));photos.push({texture,url,level:l,loading:null});if(l!==level)swap(photos.at(-1));return texture}
// WebGL2 texture storage cannot change size, so the new image goes in a fresh Source after the old one is released.
async function swap(p){
 const want=level;if(p.level===want||p.loading===want)return;p.loading=want;
 let image;try{image=await new T.ImageLoader().loadAsync(urlFor(p.url,want))}catch{p.loading=null;return}
 if(p.loading!==want)return;p.loading=null;if(level!==want)return;
 p.texture.dispose();p.texture.source=new T.Source(image);p.texture.needsUpdate=true;p.level=want;
}
export function photoStats(){return{level,levels:photos.map(p=>p.level),loading:photos.filter(p=>p.loading).length}}
