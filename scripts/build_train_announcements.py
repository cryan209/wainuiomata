"""Package original station PA announcements with local macOS speech and ffmpeg."""
import concurrent.futures
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile
import unicodedata

ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'dist/railways.json').read_text())
OUT=ROOT/'dist/audio/train'
OUT.mkdir(parents=True,exist_ok=True)
def canonical(name):return re.sub(r'\s+\([^)]*\)$','',name)
def served(station):
    for route in DATA['routes']:
        for a,b in zip(route['p'],route['p'][1:]):
            dx,dz=b['x']-a['x'],b['z']-a['z'];length=dx*dx+dz*dz
            t=max(0,min(1,((station['x']-a['x'])*dx+(station['z']-a['z'])*dz)/(length or 1)))
            if math.hypot(station['x']-a['x']-dx*t,station['z']-a['z']-dz*t)<65:return True
    return False
names=sorted({canonical(station['name']) for station in DATA['stations'] if served(station)})
def slug(name):return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFD',name).encode('ascii','ignore').decode().lower()).strip('-')
phrases=[dict(id='welcome',kind='welcome',station='',text='Welcome aboard. Please take a seat and enjoy your journey.')]
for name in names:
    for kind,text in [('approach',f'Now approaching {name} station.'),('arrival',f'This is {name} station.')]:
        phrases.append(dict(id=slug(name)+'-'+kind,kind=kind,station=name,text=text))
def probe(path):return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(path)]))
with tempfile.TemporaryDirectory(prefix='wainui-train-pa-') as temp:
    def build(phrase):
        raw=Path(temp)/(phrase['id']+'.aiff')
        subprocess.run(['say','-v','Karen','-r','165','-o',str(raw),phrase['text']],check=True)
        if probe(raw)<.3:raise RuntimeError('Local voice returned empty audio: '+phrase['id'])
        dest=OUT/(phrase['id']+'.mp3')
        # A soft two-tone chime, followed by a band-limited carriage speaker voice.
        filters='[0:a]highpass=f=220,lowpass=f=5200,loudnorm=I=-18:TP=-3:LRA=7,adelay=650:all=1[voice];sine=frequency=660:duration=0.16:sample_rate=22050,afade=t=out:st=0.04:d=0.12,volume=0.18[a];sine=frequency=880:duration=0.23:sample_rate=22050,afade=t=out:st=0.05:d=0.18,volume=0.18,adelay=200:all=1[b];[voice][a][b]amix=inputs=3:normalize=0,alimiter=limit=0.85'
        subprocess.run(['ffmpeg','-v','error','-y','-i',str(raw),'-filter_complex',filters,'-ar','22050','-ac','1','-codec:a','libmp3lame','-b:a','64k',str(dest)],check=True)
        return {**phrase,'file':'audio/train/'+dest.name,'duration':probe(dest),'voice':'Karen'}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        manifest=list(executor.map(build,phrases))
(ROOT/'dist/train-announcement-clips.js').write_text('// Packaged synthetic train PA voice; rebuild with scripts/build_train_announcements.py.\nexport const TRAIN_ANNOUNCEMENTS='+json.dumps(manifest,indent=2,ensure_ascii=False)+';\n')
print(f'Built {len(manifest)} announcements for {len(names)} stations ({sum((ROOT/"dist"/p["file"]).stat().st_size for p in manifest)/1024:.0f} KiB)')
