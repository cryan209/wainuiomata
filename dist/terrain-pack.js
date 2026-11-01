// Decoders for the compact downloads written by scripts/pack_runtime.py.
const int=(bytes,offset,count,width,i)=>{let v=0;for(let b=0;b<width;b++)v|=bytes[offset+b*count+i]<<(8*b);return width===4?v|0:v<<(32-8*width)>>(32-8*width)};

// regional-terrain.pack → the Int32 centimetre grid of regional-terrain.bin (lossless).
// Low bytes then high bytes of Int16 differences: from the left neighbour, or for the first column from the row above.
export function unpackTerrain(bytes,width,height){
 const n=width*height,out=new Int32Array(n);if(bytes.length!==2*n)throw Error('Terrain pack does not match its grid');
 let first=0;
 for(let j=0;j<height;j++){let k=j*width;first+=(bytes[k]|bytes[n+k]<<8)<<16>>16;let h=out[k]=first;for(let i=1;i<width;i++){k++;h+=(bytes[k]|bytes[n+k]<<8)<<16>>16;out[k]=h}}
 return out}

// regional-far.pack → {far: 8 floats per building, roof: 2 per building}, the layouts of regional-far.bin and
// regional-roof-far.bin, quantised for the distant view. Columns: [scale, differenced, bytes per value].
export const FAR_COLUMNS=[[10,1,4],[10,1,4],[10,1,2],[10,0,2],[10,0,2],[10,0,2],[1000,0,2],[1,0,2]],ROOF_COLUMNS=[[100,0,2],[1,0,1]];
export function unpackFar(bytes,count){
 const far=new Float32Array(count*8),roof=new Float32Array(count*2);let offset=0;
 for(const [table,columns,stride] of [[far,FAR_COLUMNS,8],[roof,ROOF_COLUMNS,2]])columns.forEach(([scale,diff,width],c)=>{
  let v=0;for(let i=0;i<count;i++){const q=int(bytes,offset,count,width,i);v=diff?v+q:q;table[i*stride+c]=v/scale}offset+=count*width});
 if(offset!==bytes.length)throw Error('Distant-building pack does not match its count');
 return{far,roof}}
