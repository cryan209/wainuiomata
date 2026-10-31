export const RADIO_STATIONS=[
 {id:'valley',name:'Valley FM',frequency:'92.4',tagline:'The valley, rewound.',tracks:['valley','harbour','hill','coast','mist','queen','petone','express','rain','seaview','rata','stars']},
 {id:'harbour',name:'Harbour Heat',frequency:'98.6',tagline:'After dark. Across the harbour.',tracks:['harbour','hill','seaview','express','queen','rata']},
 {id:'ranges',name:'Ranges Radio',frequency:'88.2',tagline:'Take the long way home.',tracks:['mist','coast','rain','stars','petone','valley']}
];
export function radioStation(id){return RADIO_STATIONS.find(s=>s.id===id)||RADIO_STATIONS[0]}
