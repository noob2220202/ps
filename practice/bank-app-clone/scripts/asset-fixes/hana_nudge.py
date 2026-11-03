# art.ts 잉크 x,y 를 화면에서 잰 만큼 옮김 (dp)
import re, sys, json
ART = '/home/user/ps/practice/bank-app-clone/src/hana/art.ts'
D = json.loads(sys.argv[1])
src = open(ART).read()
fmt = lambda x: ('%.3f' % x).rstrip('0').rstrip('.')
for name, (dx, dy) in D.items():
    m = re.search(r'  "%s": \[([^\]]+)\],' % re.escape(name), src)
    v = [float(x) for x in m.group(1).split(',')]
    v[2] += dx; v[3] += dy
    src = src.replace(m.group(0), '  "%s": [%s],' % (name, ', '.join(fmt(x) for x in v)))
    print(name, [fmt(x) for x in v])
open(ART, 'w').write(src)
