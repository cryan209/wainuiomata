"""Build original synthetic vocal hooks with macOS voices and ffmpeg."""
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Short original lyrics, timed to four beats so they fit inside one bar.
HOOKS = [
    ('harbour', 104, 'Karen', ['Harbour lights, carry me home.', 'We move together, through the night.'], 'highpass=f=180,lowpass=f=6500,aecho=0.8:0.6:110:0.18'),
    ('petone', 82, 'Daniel', ['Sun goes down, let the rhythm roll.', 'By the water, we take it slow.'], 'highpass=f=220,lowpass=f=3800,aecho=0.8:0.6:190:0.28'),
    ('summit', 132, 'Daniel', ['Over the hill, into the light!', 'Turn it up, we are alive!'], 'highpass=f=220,lowpass=f=5500,acompressor=threshold=0.12:ratio=4'),
    ('garage', 168, 'Karen', ['Hey! Hey! Here we go!', 'Our town! Our sound!'], 'highpass=f=240,lowpass=f=4800,acompressor=threshold=0.10:ratio=5'),
    ('arcade', 144, 'Zarvox', ['Ready player, hit the road.', 'Level up, here we go.'], 'highpass=f=250,lowpass=f=4200,acrusher=bits=8:mix=0.6'),
]

def probe(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(path)]))

def tempo_chain(speed):
    factors = []
    while speed > 2:
        factors.append(2)
        speed /= 2
    while speed < .5:
        factors.append(.5)
        speed /= .5
    return ','.join(f'atempo={factor:.8f}' for factor in [*factors, speed])

out = ROOT / 'dist/audio/vocals'
out.mkdir(parents=True, exist_ok=True)
manifest = []
with tempfile.TemporaryDirectory(prefix='valley-vocals-') as temp:
    for track, bpm, voice, lyrics, treatment in HOOKS:
        for index, text in enumerate(lyrics):
            ident = f'{track}-{index+1}'
            raw = Path(temp) / f'{ident}.aiff'
            trimmed = Path(temp) / f'{ident}.wav'
            subprocess.run(['say', '-v', voice, '-r', '190', '-o', str(raw), text], check=True)
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(raw), '-af', 'silenceremove=start_periods=1:start_duration=0.02:start_threshold=-45dB', str(trimmed)], check=True)
            target = 4 * 60 / bpm * .88
            duration = probe(trimmed)
            if duration < .2:
                raise RuntimeError(f'Voice {voice} returned empty or silent audio for {ident}')
            filters = f'{tempo_chain(duration/target)},{treatment},afade=t=in:d=0.012,afade=t=out:st={target-.08:.5f}:d=0.08,loudnorm=I=-18:TP=-3:LRA=7'
            dest = out / f'{ident}.mp3'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(trimmed), '-af', filters, '-t', str(target), '-ar', '22050', '-ac', '1', '-codec:a', 'libmp3lame', '-b:a', '64k', str(dest)], check=True)
            manifest.append(dict(track=track, id=ident, text=text, voice=voice, bpm=bpm, beats=4, file=f'audio/vocals/{ident}.mp3', duration=probe(dest)))
(ROOT / 'dist/vocal-hooks.js').write_text('// Original lyrics; packaged synthetic voices. Rebuild with scripts/build_music_vocals.py.\nexport const VOCAL_HOOKS='+json.dumps(manifest, indent=2)+';\n')
print(f'Built {len(manifest)} vocal hooks ({sum((out / (h["id"]+".mp3")).stat().st_size for h in manifest)/1024:.0f} KiB)')
