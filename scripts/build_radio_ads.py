import json,subprocess,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
ads=[
 ('dairy','Valley Dairy','Karen','Valley Dairy. Milk, bread, and the ice cream you came in for by accident. Pop down before the kettle boils. Valley Dairy. Just around the corner.'),
 ('cycle','Valley Cycle Works','Daniel','Chain making more noise than your radio? Valley Cycle Works can sort that. Punctures, tune ups, and friendly advice. Valley Cycle Works. Keep the valley rolling.'),
 ('cafe','The Long Way Home Café','Karen','Take the long way home. There is a hot coffee and something fresh from the oven waiting at the Long Way Home Cafe. Your next stop can wait.'),
 ('records','Valley Records','Daniel','Still rewinding the same cassette? Find your next favourite at Valley Records. New discoveries, old favourites, and plenty of questionable album covers. Valley Records. Give your dashboard something new.'),
 ('fish','Valley Fish & Chips','Karen','Dinner plans gone a bit sideways? Valley Fish and Chips has you covered. Hot chips, crispy batter, and one extra scoop for the ride home. Follow your nose, valley.'),
 ('station','Valley FM','Daniel','From the hill road to the harbour. You are listening to Valley F M. Locally imagined. Slightly out of time. Stay with us for another tune from the valley.')
]
(root/'dist/audio/radio').mkdir(parents=True,exist_ok=True)
manifest=[]
with tempfile.TemporaryDirectory(prefix='valley-radio-') as temp_dir:
 for ident,title,voice,text in ads:
  aiff=str(Path(temp_dir)/f'{ident}.aiff')
  subprocess.run(['say','-v',voice,'-r','172','-o',aiff,text],check=True)
  dest=root/f'dist/audio/radio/{ident}.mp3'
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',aiff,'-af','highpass=f=180,lowpass=f=4800,loudnorm=I=-19:TP=-3:LRA=7','-ar','22050','-ac','1','-codec:a','libmp3lame','-b:a','64k',str(dest)],check=True)
  duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(dest)]))
  manifest.append(dict(id=ident,title=title,text=text,file=f'audio/radio/{ident}.mp3',duration=duration))
(root/'dist/audio/radio/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Generated {len(manifest)} radio spots, {sum(a["duration"] for a in manifest):.0f} seconds total')
