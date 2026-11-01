import argparse,json,subprocess,tempfile
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
extra_ads=[
 ('motors','Hill Road Motors','Daniel','Hill Road Motors. Is your car making a noise you have started describing as normal? Bring it in. We speak fluent rattle, squeak, and mysterious clunk. Hill Road Motors. We will have a listen.'),
 ('video','Saturday Video','Karen','Saturday Video. Three aisles of action, one shelf of romance, and a return slot that never judges your choices. Grab something for tonight. Saturday Video. Please rewind. Yes, even the good bits.'),
 ('garden','Green Gum Garden Centre','Karen','Green Gum Garden Centre. Bought one plant and somehow came home with twelve? We understand. Pots, seedlings, and advice for the plant you swear was fine yesterday. Green Gum. Let the garden take over.'),
 ('pizza','Harbour Pizza Hotline','Daniel','Harbour Pizza Hotline. Feeding a flat, a family, or just a very ambitious evening? We have the slices. Pick your toppings and leave the dishes in the cupboard. Harbour Pizza. Dinner, in a box.'),
 ('laundry','The Sock Exchange','Karen','The Sock Exchange Laundry. We cannot promise to find the missing sock. Nobody can. But we can sort the muddy trousers, mystery towels, and that enormous duvet. The Sock Exchange. A fresh start for your washing basket.'),
 ('computers','Valley Byte Computers','Daniel','Valley Byte Computers. Your computer has stopped responding. Your cousin has stopped answering. Time to call us. Repairs, upgrades, and a patient explanation of which cable goes where. Valley Byte. Save your work. Then come see us.'),
 ('hardware','Ridge and Rafter Hardware','Daniel','Ridge and Rafter Hardware. Started a small job on Saturday and now the kitchen has no door? We have the screws you dropped, the hinge you need, and a slightly bigger hammer. Ridge and Rafter. Finish what you started.'),
 ('barber','Queen Street Clippers','Karen','Queen Street Clippers. A little off the top, a tidy round the ears, and absolutely no guarantees about the weather outside. Walk in looking windswept. Walk out looking deliberately styled. Queen Street Clippers. Your hat can have the afternoon off.'),
 ('roofing','Raincheck Roofing','Daniel','Raincheck Roofing. If you have named the bucket under that leak, it is time to give us a call. Repairs, gutters, and fewer indoor water features. Raincheck Roofing. Keep the rain where it belongs. Outside.'),
 ('pancakes','Petone Pancake Parlour','Karen','Petone Pancake Parlour. Breakfast is a state of mind, especially after lunch. Fluffy stacks, hot coffee, and one more drizzle of syrup than you meant to ask for. Petone Pancake Parlour. Take a seat. We will get the pan on.'),
 ('lodge','Last Stop Lodge','Karen','Last Stop Lodge. Taking the long way home has become taking the really long way home? Stay the night. A comfy bed, a kettle, and somewhere to put your feet up. Last Stop Lodge. You can be early tomorrow.'),
 ('tyres','Wonky Wheel Tyres','Daniel','Wonky Wheel Tyres. Despite the name, we do prefer them round. New tyres, wheel balancing, and advice that does not go round in circles. Wonky Wheel. For a smoother trip over the hill and a quieter passenger seat.')
]
# Put new spots between the original ones so short sessions hear the expanded rotation.
ads=[ad for index,original in enumerate(ads) for ad in [original,*extra_ads[index*2:index*2+2]]]
parser=argparse.ArgumentParser()
parser.add_argument('--only-new',action='store_true',help='Reuse unchanged packaged spots and build only additions')
args=parser.parse_args()
manifest_path=root/'dist/audio/radio/manifest.json'
previous={ad['id']:ad for ad in json.loads(manifest_path.read_text())} if manifest_path.exists() else {}
(root/'dist/audio/radio').mkdir(parents=True,exist_ok=True)
manifest=[]
with tempfile.TemporaryDirectory(prefix='valley-radio-') as temp_dir:
 for ident,title,voice,text in ads:
  dest=root/f'dist/audio/radio/{ident}.mp3'
  old=previous.get(ident)
  if args.only_new and old and old['text']==text and old['title']==title and dest.exists():
   manifest.append(old);continue
  aiff=str(Path(temp_dir)/f'{ident}.aiff')
  subprocess.run(['say','-v',voice,'-r','172','-o',aiff,text],check=True)
  subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',aiff,'-af','highpass=f=180,lowpass=f=4800,loudnorm=I=-19:TP=-3:LRA=7','-ar','22050','-ac','1','-codec:a','libmp3lame','-b:a','64k',str(dest)],check=True)
  duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(dest)]))
  manifest.append(dict(id=ident,title=title,text=text,file=f'audio/radio/{ident}.mp3',duration=duration))
(root/'dist/audio/radio/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Generated {len(manifest)} radio spots, {sum(a["duration"] for a in manifest):.0f} seconds total')
