export const RADIO_STATIONS=[
 {id:'valley',name:'Valley FM',preset:'VALLEY',frequency:'92.4',tagline:'The valley, rewound.',tracks:['valley','harbour','hill','coast','mist','queen','petone','express','rain','seaview','rata','stars','summit','garage','bonfire','arcade','pixel','savepoint']},
 {id:'harbour',name:'Harbour Heat',preset:'HARBR',frequency:'98.6',tagline:'After dark. Across the harbour.',tracks:['harbour','hill','seaview','express','queen','rata','summit','garage','arcade','pixel']},
 {id:'ranges',name:'Ranges Radio',preset:'RANGES',frequency:'88.2',tagline:'Take the long way home.',tracks:['mist','coast','rain','stars','petone','valley','bonfire','savepoint']},
 {id:'summit',name:'Summit Rock',preset:'SUMMIT',frequency:'101.3',tagline:'Turn it up over the hill.',tracks:['summit','garage','bonfire']},
 {id:'pixel',name:'Pixel FM',preset:'PIXEL',frequency:'106.4',tagline:'Insert coin. Hit the road.',tracks:['arcade','pixel','savepoint']},
 {id:'groove',name:'Petone Groove',preset:'GROOVE',frequency:'94.7',tagline:'Funk, dub and a little sunshine.',tracks:['queen','petone','rata','valley','harbour','rain']},
 {id:'night',name:'Night Drive',preset:'NIGHT',frequency:'103.8',tagline:'Breakbeats until the lights come on.',tracks:['express','seaview','hill','harbour']},
 {id:'coast',name:'Coast Keys',preset:'COAST',frequency:'90.1',tagline:'Soft keys. Open horizons.',tracks:['coast','rain','valley','mist','stars']}
];
export function radioStation(id){return RADIO_STATIONS.find(s=>s.id===id)||RADIO_STATIONS[0]}
export function nextRadioStation(id,direction=1){const index=RADIO_STATIONS.indexOf(radioStation(id));return RADIO_STATIONS[(index+(direction<0?-1:1)+RADIO_STATIONS.length)%RADIO_STATIONS.length]}
