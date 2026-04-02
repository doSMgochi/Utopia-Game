import codecs
with codecs.open('index.html','r','utf-8') as f:
    for i,line in enumerate(f,1):
        if 9690 <= i <= 9805:
            print(f'{i}:{line.rstrip()}')
