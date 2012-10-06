
var master = require('./streamMaster')()
  , master2 = require('./streamMaster')()
  , request = require('request')
  , assert = require('assert')
  , fs = require('fs')

//each child stream emits data normally, but buffers data to notify parent of incoming data
//parent doesn't emit data until a child stream has buffed max limit or has ended


var count = 0
//master.bufSize = 0 //this will make children not buffer data

//test the case of many child streams
var s1 = request('http://saambarati.org/')
s1.pipe(master.child())
count++

var s2 = request('http://saambarati.org/about')
s2.pipe(master.child())
count++

var s3 = request('http://github.com')
s3.pipe(master.child())
count++

//argument to child
var testRequestStream =  request('http://github.com/saambarati')
var s4 = master.child( testRequestStream )
assert(s4 === testRequestStream)
//s4.pipe(process.stdout)
count++

var s5 = master.child(0)
assert(s5.bufSize === 0)
count++
s5.write('not buffering the 5th stream')


var cleanCalled = false
function clean() {
  //make sure end is called in proportion to the number of children master has
  cleanCalled = true
  count-=1
  assert(count === master.numberOfChildren)
}

s1.once('end', clean)
s2.once('end', clean)
s3.once('end', clean)
s4.once('end', clean)
s5.once('end', clean)

s5.end()

var dataEmits = 0
master.on('data', function(data) {
  dataEmits += 1
  console.log('number of time master has emitted data: %d', dataEmits)
  //console.log(data)
})

var zeroChildrenEmitted = false
//master.pause()
master.once('zeroChildren', function() {
  zeroChildrenEmitted = true

  //assert(master.paused)
  master.resume()
  assert(!master.paused)
  assert(master.numberOfChildren === 0)
})


//test for the case of an argument being passed to to stream-master.child()
var fn = './test_child_stream'
  , master2Data = ''

master2.child(master) //master2 will listen to data events from master 1
master2.pipe(fs.createWriteStream(fn))
master2.on('data', function(d) {
  master2Data += d.toString()
})


process.on('exit', function() {
  assert(cleanCalled)
  assert(zeroChildrenEmitted)
  assert(master2Data === fs.readFileSync(fn, 'utf8'))
  fs.unlinkSync(fn)
  console.log('\n\nProcess exiting, all tests have passed')
})







//setTimeout(function() {
//  master.resume()
//}, 1000 * 5)
