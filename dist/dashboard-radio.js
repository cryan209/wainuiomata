import {RADIO_STATIONS,radioStation} from './radio-stations.js';
// Compact stereo stays usable in chase view and on touch screens.
export function createDashboardRadio({sound,root=document.querySelector('#dashboard-radio')}){
 if(!root)return {update(){}};
 const display=root.querySelector('[data-radio-display]'),track=root.querySelector('[data-radio-track]'),dial=root.querySelector('[data-radio-dial]'),power=root.querySelector('[data-radio-power]'),volume=root.querySelector('[data-radio-volume]');
 const presets=[...root.querySelectorAll('[data-radio-preset]')];
 const tune=index=>sound.tune(RADIO_STATIONS[(index+RADIO_STATIONS.length)%RADIO_STATIONS.length].id);
 presets.forEach((button,index)=>button.onclick=()=>tune(index));
 dial.oninput=()=>tune(Number(dial.value));
 root.querySelector('[data-radio-prev]').onclick=()=>tune(RADIO_STATIONS.indexOf(radioStation(sound.radioState.station))-1);
 root.querySelector('[data-radio-next]').onclick=()=>tune(RADIO_STATIONS.indexOf(radioStation(sound.radioState.station))+1);
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
