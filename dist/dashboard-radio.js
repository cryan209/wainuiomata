import {RADIO_STATIONS,radioStation,nextRadioStation} from './radio-stations.js?v=stations-2';
// Compact stereo stays usable in chase view and on touch screens.
export function createDashboardRadio({sound,root=document.querySelector('#dashboard-radio')}){
 if(!root)return {update(){}};
 const display=root.querySelector('[data-radio-display]'),track=root.querySelector('[data-radio-track]'),dial=root.querySelector('[data-radio-dial]'),power=root.querySelector('[data-radio-power]'),volume=root.querySelector('[data-radio-volume]');
 const presetPanel=root.querySelector('.stereo-presets');
 const presets=RADIO_STATIONS.map((station,index)=>{const button=document.createElement('button');button.type='button';button.setAttribute('data-radio-preset','');button.setAttribute('aria-label',`Preset ${index+1} · ${station.frequency} FM · ${station.name}`);button.title=`${station.frequency} FM · ${station.name}`;button.textContent=station.preset;return button});
 presetPanel.replaceChildren(...presets);
 dial.min='0';dial.max=String(RADIO_STATIONS.length-1);dial.step='1';
 const tune=index=>sound.tune(RADIO_STATIONS[(index+RADIO_STATIONS.length)%RADIO_STATIONS.length].id);
 presets.forEach((button,index)=>button.onclick=()=>tune(index));
 dial.oninput=()=>tune(Number(dial.value));
 root.querySelector('[data-radio-prev]').onclick=()=>sound.tune(nextRadioStation(sound.radioState.station,-1).id);
 root.querySelector('[data-radio-next]').onclick=()=>sound.tune(nextRadioStation(sound.radioState.station,1).id);
 power.onclick=()=>sound.setRadioPower(!sound.radioState.power);
 volume.oninput=()=>sound.setMusicVolume(Number(volume.value));
 let text='',name='';
 return {update({active,driving}){
  root.hidden=!active||!driving;
  if(root.hidden)return;
  const state=sound.radioState,station=radioStation(state.station),index=RADIO_STATIONS.indexOf(station),line=state.power?`${station.frequency} FM · ${station.name}`:'RADIO OFF',song=state.power?(state.ad?'Local break · '+state.ad:state.track):'Press POWER to listen';
  if(text!==line){display.textContent=line;text=line}if(name!==song){track.textContent=song;name=song}
  dial.value=String(index);volume.value=String(state.volume);power.setAttribute('aria-pressed',String(state.power));
  presets.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index&&state.power)));
 }};
}
