// Keep the boarding controls in sync with the complete set of running services.
export function createTrainLineControls({trains,selects,onSelect}){
 const controls=selects.filter(Boolean);
 for(const select of controls){
  const doc=select.ownerDocument||document,options=[{value:'',name:'Choose a line to ride…'},...trains.map((train,index)=>({value:String(index),name:train.name}))];
  select.replaceChildren(...options.map(option=>{const element=doc.createElement('option');element.value=option.value;element.textContent=option.name;return element}));
  select.disabled=!trains.length;
  select.onchange=()=>{const value=select.value,index=Number(value);if(value!==''&&Number.isInteger(index)&&trains[index])onSelect(index)};
 }
 return {update(train){const index=trains.indexOf(train),value=index<0?'':String(index);for(const select of controls)if(select.value!==value)select.value=value}};
}
