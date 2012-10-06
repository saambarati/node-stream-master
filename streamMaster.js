
var Stream = require('stream')
  , util = require('util')
  , DEBUG = false
  , debug

if (DEBUG) debug = console.log
else debug = function() {}


/*
 * @param opts {object}
 *     {number} opts.bufSize
 *        (buffer size for the child() streams. When the data surpasses this buffer limit, they will emit data. When bufSize === 0, streams just emit data)
 *
 * @return {Master}
 *   (returns a Master stream. Master streams are readable but not writable stream instances)
*/
module.exports = function(opts) {
  return new Master(opts)
}

/*
 * @api private
 * @param {Object|undefined} opts
*/
function BufferedStream(opts) {
  opts = opts || {}

  Stream.call(this)

  // up to subclasses to decide what kind of stream we are
  this.writable = false
  this.readable = false

  this.buffers = []
  this.paused = false
  this.concat = !!opts.concat //boolean indicating if we should emit separate buffers or concat buffers into one 'emit' event
}
util.inherits(BufferedStream, Stream)

BufferedStream.prototype.pause = function() {
  debug('becoming paused')
  this.paused = true
}

BufferedStream.prototype.resume = function() {
  this.paused = false
  var self = this
  process.nextTick(function() {
    self.unloadBuffers()
  })
}

BufferedStream.prototype.unloadBuffers = function() {
  if (this.paused) return

  debug('BufferedStream: unloadBuffers')
  if (this.concat) { //emit one big concatenated buffer
    this.emit('data', Buffer.concat(this.buffers))
    this.buffers = []
    //debug('BufferedStream: emitting concat buffer')
  } else { //emit each buffer in 'fifo' order
    while (this.buffers.length && !this.paused) {
      //debug('BufferedStream: emitting individual buffer')
      this.emit('data', this.buffers.shift())
    }
  }
}


/*
 * @param {Object|undefined} opts
 *     {number} opts.bufSize  buffer size for the children streams. When their data surpasses this buffer limit, they will emit data
 *
 * @emits 'zeroChildren' event when all child streams have emmitted 'end'
 *
 * @inherits {BufferedStream => Stream}
*/
function Master(opts) {
  opts = opts || {}

  BufferedStream.call(this, {concat : opts.concat})

  this.writable = false //call Master.child for writable stream
  this.readable = true

  //this.children = {}
  this.bufSize = opts.bufSize || 1024 * 10 //10kb
  this.numberOfChildren = 0

  this.paused = false
}
util.inherits(Master, BufferedStream)

/**
 * @api public
 *
 * @param {stream|null}
 *       if  a stream is passed as the argument, then the child stream will be the passed in stream, else, it will be an instance of {Child}
 *
*/
Master.prototype.child = function(streamOrBufSize) {
  var self = this
    , child
    , ended

  child = ( typeof stream !== 'number' && streamOrBufSize ? streamOrBufSize
            : new Child({concat : true, bufSize : (typeof streamOrBufSize === 'number' ? streamOrBufSize : this.bufSize) }) //if stream is a number, make it the bufSize
          )
  if (!child.readable) console.warn('Warning in stream-master: child stream should be a "readable" stream or else it serves no use being in stream-master')

  self.numberOfChildren += 1

  ended = false

  function onData(data) {
    debug('on parent called inside master')
    if (self.paused){
      self.buffers.push(data)
      debug('buffering child data')
    } else {
      debug('master emitting data')
      self.emit('data', data)
    }
  }

  function onEnd() {
    debug('ended child stream')
    cleanup()
  }

  function onError(e) {
    debug(e)
    self.emit('error', e)
    cleanup()
  }

  function cleanup() {
    if (ended) return

    ended = true
    self.numberOfChildren -= 1

    debug('number of children in master-stream: %d', self.numberOfChildren)
    if (self.numberOfChildren === 0) {
      self.emit('zeroChildren') //good marker if you want multiple streams to finish before reading data from Master-stream
    }
    debug('cleanup method called')
  }

  child.once('end', onEnd)
  child.once('error', onError)
  child.on('data', onData)

  return child
}

//child stream
function Child(opts) {
  opts = opts || {}
  BufferedStream.call(this, {concat : opts.concat})

  this.writable = true //call Master.child for writable stream
  this.readable = true

  this.bufSize = (opts.bufSize === Infinity || !opts.bufSize ? 0 : opts.bufSize) //max bytes before emitting
  this.bufLength = 0 //bytes stored in buffer

  this.hasEnded = false
}

util.inherits(Child, BufferedStream)

Child.prototype.write = function(data) {
  if (!Buffer.isBuffer(data)) {
    var bufWithProps = new Buffer(data.toSting())
    Object.getOwnPropertyNames(data).forEach(function(prop) {
      bufWithProps[prop] = data[prop]
    })
    data = bufWithProps
  }

  this.buffers.push(data)
  this.bufLength += data.length

  this.unloadBuffers()

  return !this.paused
}

Child.prototype.unloadBuffers = function() {
  if (this.paused) return

  var bigBuf
    , cBuf

  debug('unloading buffers in child')
  //no bufferLimit or we have exceeded limit. If we have ended, also unload buffers
  if (this.hasEnded || !this.bufSize || this.bufLength > this.bufSize) {
    if (this.concat) { //emit a big buffer
      bigBuf = Buffer.concat(this.buffers)
      this.emit('data', bigBuf)
      debug('emitting concat buffer data')
      this.buffers = []
      this.bufLength = 0
    } else {
      while (this.buffers.length && !this.paused) {
        cBuf = this.buffers.shift()
        this.bufLength -= cBuf.length
        this.emit('data', cBuf)
      }
    }
  }
}

Child.prototype.end = function(data) {
  debug('end called in Child')
  this.hasEnded = true

  if (data) this.write(data)
  else this.unloadBuffers() //else b/c write() calls unloadBuffers

  this.emit('end')
}


