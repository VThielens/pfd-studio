# Step 2: build iso-symbols.js from iso.json with EN/FR/NL names (tr.py) and default tag prefixes.
# Usage: python3 build.py  (in the folder that holds iso.json)
import json, sys
import os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from tr import T, GROUPS, EN_FIX
d=json.load(open('iso.json'))
PREF={1:'B',2:'C',3:'E',4:'H',5:'CT',6:'F',7:'S',8:'S',9:'Z',10:'D',11:'M',12:'R',13:'X',14:'X',15:'P',16:'K',17:'G',18:'T',19:'FD',20:'M'}
syms=[]; ids=set(); missing=[]
seen_desc=set()
for s in d['symbols']:
    if s.get('empty'): continue
    if s['reg']=='301' and s['group']!=1: continue
    en=EN_FIX.get(s['desc'], s['desc'])
    if (s['reg'],en) in seen_desc: continue
    seen_desc.add((s['reg'],en))
    if en not in T: missing.append(en); fr=nl=en
    else: fr,nl=T[en]
    base='iso_'+s['reg']; i=base; k=2
    while i in ids: i=base+'_'+str(k); k+=1
    ids.add(i)
    g=s['group']; ports=s['ports']
    w,h=s['w'],s['h']
    if not ports:
        if g<=20 or g==24: ports=[[round(w/2,1),0,'u'],[round(w/2,1),h,'d'],[0,round(h/2,1),'l'],[w,round(h/2,1),'r']]
        elif g==28: ports=[[round(w/2,1),0,'u']]
    syms.append({'id':i,'reg':s['reg'],'group':g,'names':{'en':en,'fr':fr,'nl':nl},'w':w,'h':h,'ports':ports,'svg':s['svg'],
                 'prefix':PREF.get(g,''),'showTag': g<=20})
groups=[{'num':n,'names':{'en':v[0],'fr':v[1],'nl':v[2]},'prefix':PREF.get(n,'')} for n,v in sorted(GROUPS.items())]
print('missing',missing, 'count', len(syms))
js='''/*
 * ISO 10628-2:2012 symbols, extracted automatically from
 * "ISO 10628-2:2012 Symbols" sheets 1-7 by Steven Baltakatei Sandoval,
 * Wikimedia Commons, licence CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/).
 * This file is a derivative work and is distributed under the same licence.
 * Connection points come from the "preferred connection locations" marked on the sheets.
 */
window.PFD_ISO = '''+json.dumps({'groups':groups,'symbols':syms,'defs':d['defs']},ensure_ascii=False,separators=(',',':'))+';\n'
open('iso-symbols.js','w').write(js)
print(len(js))
