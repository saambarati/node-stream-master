
# stream-master

stream-master is an API for joining multiple streams together under a single streaming parent.
At the current moment, stream-master just combines `child` streams in arbitrary fashion, but in the future
it will emit `data` events per each child stream in more ordered fashion. It is still possible to isolate individual streams
within stream-master because the `child` function will return the specific stream that has become a child if stream-master.

stream-master also emits a `zeroChildren` event when all its child streams have emitted `end`. This is useful
if you want all your child streams to finish before doing something else with them.


### API

`var master = require('stream-master')` master is a readable stream in this case, not writable.
stream-master `exports` a single function that takes an options object as an argument.
`opts.bufSize` is the  buffer size for the children streams of stream-master (when not passed an argument to the `child` function).
When child streams surpass this buffer limit, they will emit the buffered data.

#### `child` function

    //bufSize indicates how much data child streams should buffer before emmiting data. pass 0 for data to be emmited without buffering
    var master = require('stream-master')({bufSize:1024 * 5}) //returns a readable stream.
      , fs = require('fs')

    //each child stream emits data normally, but buffers data to notify parent of incoming data
    //parent doesn't emit data until a child stream has buffed max limit or has ended

    var child1 = request('http://npmjs.org').pipe(master.child()) //child returns a readable/writable stream
    child.pipe(fs.createWriteStream(fileName) //child emits data from the 'request' pipe
    //same as:   request('http://saambarati.org/').pipe(master.child()).pipe(fs.createWriteStream(fileName))

    var child2 = request('http://nodejs.org').pipe(master.child())

    //pass a readable stream as an argument to master.child()
    var child3 = master.child( request('http://github.com') ) // child3 === request('http://github.com')
    child3.pipe(process.stdout)

    master.pipe(fs.createWriteStream(masterFile)) //master emits data of both child1 and child2 and child 3

