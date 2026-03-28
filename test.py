import re
text = open('frontend_js.js', encoding='utf-8').read()
m = re.search(r'[\"\'][^\"\']*khtr[^\"\']*[\"\']', text)
print(m.group(0) if m else 'none')
