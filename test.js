
var master = require('./streamMaster')()
  , request = require('request')
  , assert = require('assert')

//each child stream emits data normally, but buffers data to notify parent of incoming data
//parent doesn't emit data until a child stream has buffed max limit or has ended

master.pause()

var count = 0

var s1 = request('http://saambarati.org/')
s1.pipe(master.child())
count++

var s2 = request('http://saambarati.org/about')
s2.pipe(master.child())
count++

var s3 = request('http://github.com')
s3.pipe(master.child())
count++

var cleanCalled = false
function clean() {
  cleanCalled = true
  count-=1
  assert(count === master.numberOfChildren)
}

s1.once('end', clean)
s2.once('end', clean)
s3.once('end', clean)

var dataEmits = 0
master.on('data', function(data) {
  dataEmits += 1
  console.log('data emits: %d', dataEmits)
  console.log(data)
})

var zeroChildrenEmitted = false
master.once('zeroChildren', function() {
  zeroChildrenEmitted = true

  assert(master.paused)
  master.resume()
  assert(!master.paused)
  assert(master.numberOfChildren === 0)
})

process.on('exit', function() {
  assert(cleanCalled)
  assert(zeroChildrenEmitted)
  console.log('process exiting, all tests have passed')
})






//setTimeout(function() {
//  master.resume()
//}, 1000 * 5)
