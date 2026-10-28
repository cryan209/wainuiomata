import * as T from './vendor/three.js';
// Small, repeatable pixel textures keep the PS2 feel without a sepia colour cast.
function random(seed){return()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646}}
function texture(size,paint,seed=3){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const ctx=canvas.getContext('2d');paint(ctx,size,random(seed));const t=new T.CanvasTexture(canvas);t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.NearestFilter;t.minFilter=T.LinearMipmapLinearFilter;t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t}
function grain(c,n,r,count,light,dark){for(let i=0;i<count;i++){c.fillStyle=r()>.5?light:dark;const x=Math.floor(r()*n),y=Math.floor(r()*n);c.fillRect(x,y,r()>.85?2:1,1)}}
export function makeTextures(){
 const grass=texture(256,(c,n,r)=>{c.fillStyle='#529749';c.fillRect(0,0,n,n);for(let i=0;i<2500;i++){c.fillStyle=['#62a453','#478c43','#70ad59','#3f843e','#579e48'][i%5];let x=Math.floor(r()*n),y=Math.floor(r()*n);c.fillRect(x,y,2+Math.floor(r()*4),1+Math.floor(r()*3))}for(let i=0;i<1800;i++){c.fillStyle=r()>.5?'#82b766':'#397a39';c.fillRect(Math.floor(r()*n),Math.floor(r()*n),1,2)}});
 const asphalt=texture(256,(c,n,r)=>{c.fillStyle='#48535e';c.fillRect(0,0,n,n);grain(c,n,r,18000,'#63717b','#36434d');for(let i=0;i<16;i++){c.strokeStyle='#303c4566';c.lineWidth=1;c.beginPath();let x=r()*n,y=r()*n;c.moveTo(x,y);for(let j=0;j<5;j++){x+=r()*7-3;y+=r()*6;c.lineTo(x,y)}c.stroke()}},8);
 const concrete=texture(256,(c,n,r)=>{c.fillStyle='#aebac3';c.fillRect(0,0,n,n);grain(c,n,r,6500,'#cbd4da','#97a5af');c.strokeStyle='#929fa8';c.lineWidth=1;for(let i=0;i<n;i+=64){c.beginPath();c.moveTo(i,0);c.lineTo(i,n);c.moveTo(0,i);c.lineTo(n,i);c.stroke()}},9);
 const metal=texture(128,(c,n,r)=>{c.fillStyle='#d7dfe5';c.fillRect(0,0,n,n);for(let x=0;x<n;x+=8){c.fillStyle='#f1f4f5';c.fillRect(x,0,2,n);c.fillStyle='#a7b4c0';c.fillRect(x+5,0,1,n);c.fillStyle='#c3ced8';c.fillRect(x+6,0,2,n)}grain(c,n,r,1000,'#ffffff15','#263c4812');for(let y=0;y<n;y+=64){c.fillStyle='#83939e';c.fillRect(0,y,n,1)}},12);
 const walls=[];
 for(let style=0;style<4;style++)walls.push(texture(256,(c,n,r)=>{c.fillStyle='#f0f3f4';c.fillRect(0,0,n,n);
  if(style===0){for(let y=0;y<n;y+=13){c.fillStyle='#c3cdd2';c.fillRect(0,y,n,1);c.fillStyle='#ffffff';c.fillRect(0,y+1,n,1)}}
  if(style===1){c.fillStyle='#bfc7cc';c.fillRect(0,0,n,n);for(let y=0;y<n;y+=16)for(let x=-32;x<n;x+=64){const ox=x+(Math.floor(y/16)%2)*32;c.fillStyle=['#e1e3e3','#d2d8dc','#eceeef'][Math.floor(r()*3)];c.fillRect(ox+1,y+1,62,14)}}
  if(style===2){grain(c,n,r,5500,'#fff6','#68819020');c.fillStyle='#c4ced4';c.fillRect(0,0,2,n)}
  // One storey per vertical repeat: skirting, wall surface and blue window glass.
  c.fillStyle='#a6b4bd';c.fillRect(0,n-22,n,22);c.fillStyle='#6d8392';c.fillRect(0,n-22,n,2);
  const windows=style===3?[[9,58,104,133],[135,58,109,133]]:[[24,57,77,115],[153,57,77,115]];
  if(style===3){c.fillStyle='#6f9eae';c.fillRect(0,27,n,22);c.fillStyle='#dce8ed';c.fillRect(0,49,n,3)}
  for(const [x,y,w,h]of windows){c.fillStyle='#fff';c.fillRect(x-4,y-4,w+8,h+8);c.fillStyle='#344f64';c.fillRect(x,y,w,h);c.fillStyle='#639fb9';c.fillRect(x+3,y+3,w-6,h-6);c.fillStyle='#91c1d4';c.beginPath();c.moveTo(x+3,y+3);c.lineTo(x+w-3,y+3);c.lineTo(x+3,y+h*.65);c.fill();c.fillStyle='#456b82';c.fillRect(x+3,y+h*.64,w-6,h*.36-3);c.fillStyle='#e2ebed';c.fillRect(x+w/2-1,y,3,h);c.fillRect(x,y+h*.5,w,3);c.fillStyle='#688695';c.fillRect(x-5,y+h+4,w+10,4)}
  grain(c,n,r,1200,'#ffffff10','#243f5010');
 },20+style));
 return{grass,asphalt,concrete,metal,walls};
}
export function addSky(scene){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const c=canvas.getContext('2d');let gradient=c.createLinearGradient(0,0,0,512);gradient.addColorStop(0,'#418ed1');gradient.addColorStop(.45,'#79b9e5');gradient.addColorStop(.63,'#bbdce9');gradient.addColorStop(1,'#dbeaf0');c.fillStyle=gradient;c.fillRect(0,0,1024,512);const r=random(112);for(let i=0;i<22;i++){let x=r()*1024,y=100+r()*105,s=4+r()*10;for(let j=0;j<7;j++){c.fillStyle=j<2?'#cddfea':'#eef7fa';c.beginPath();c.ellipse(x+(r()-.5)*s*3,y+(r()-.5)*s*.5,s*(.5+r()),s*(.16+r()*.2),0,0,Math.PI*2);c.fill()}}const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;const sky=new T.Mesh(new T.SphereGeometry(10000,32,16),new T.MeshBasicMaterial({map:t,side:T.BackSide,depthWrite:false,fog:false}));sky.renderOrder=-10;scene.add(sky)}
