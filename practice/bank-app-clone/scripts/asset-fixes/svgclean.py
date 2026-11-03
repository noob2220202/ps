# potrace 부스러기 지우기: 폭 1 미만이거나 넓이(상자) 2 미만인 부분 경로는 버림
import re, sys
def clean(src, min_w=1.0, min_area=2.0):
    dropped = []
    def fix(m):
        d = m.group(2)
        subs = re.findall(r'M[^M]*', d)
        keep = []
        for sp in subs:
            nums = [float(v) for v in re.findall(r'-?\d+(?:\.\d+)?', sp)]
            xs, ys = nums[0::2], nums[1::2]
            w, h = max(xs) - min(xs), max(ys) - min(ys)
            if min(w, h) < min_w or w * h < min_area:
                dropped.append((round(min(xs), 2), round(min(ys), 2), round(w, 2), round(h, 2)))
            else:
                keep.append(sp)
        return m.group(1) + ''.join(keep) + m.group(3) if keep else ''
    out = re.sub(r'(<path [^>]*?d=")([^"]*)("[^>]*/>)', fix, src)
    return out, dropped
for p in sys.argv[1:]:
    s = open(p).read()
    o, dr = clean(s)
    open(p, 'w').write(o)
    print(p.split('/')[-1], 'dropped', len(dr), dr)
