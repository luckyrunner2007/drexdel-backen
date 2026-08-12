import sys
p = r'c:\Users\HP\DREXDEL\drexdel-backend\prisma\schema.prisma'
with open(p, 'rb') as fh:
    d = fh.read()
before = d[:3] == b'\xef\xbb\xbf'
if before:
    d = d[3:]
with open(p, 'wb') as fh:
    fh.write(d)
print('BOM was present:', before)
print('first 16 bytes:', d[:16])
