var path = require('path');
var fs = require('fs');
var tarEntries = require('tar-entries');

function TarIndex(tarPath) {
  this.tarPath = tarPath;
  this.name = path.basename(tarPath);
  this.indexName = this.name + '-index';
}

TarIndex.prototype.write = function (cb) {
  var indexDescriptor;
  var entryEmitter = tarEntries(fs.createReadStream(this.tarPath));
  entryEmitter.pause();
  entryEmitter.on('entry', write.bind(this));
  entryEmitter.on('end', function () {
    fs.close(indexDescriptor);
    cb(null);
  });
  var buf = new Buffer(8);
  function write(entry) {
    var name = parsePartName(entry.path);
    buf.writeUInt32LE(entry.start / 512, 0);
    buf.writeUInt32LE(entry.size, 4);
    fs.write(indexDescriptor, buf, 0, 8, (name.part-1)*8, function (err, bytes, buffer) {
      if (err) throw err;
    });
  }

  fs.open(this.indexName, 'w', function (err, fd) {
    indexDescriptor = fd;
    entryEmitter.resume();
  });
};

TarIndex.prototype.ensureIndex = function (then) {
  fs.exists(this.indexName, function (exists) {
    if (exists) {
      then(null);
    } else {
      this.write(then);
    }
  }.bind(this));
};

TarIndex.prototype.readEntry = function (part, cb) {
  var index = this;
  var buf = new Buffer(8);
  function doReadEntry() {
    console.log('read entry', part);
    readRange(index.indexName, buf, (part-1)*8, 8, function (err, bytes, buffer) {
      var s = buffer.readUInt32LE(0);
      var start = buffer.readUInt32LE(0) * 512;
      var size = buffer.readUInt32LE(4);
      cb(null, [start, size]);
    });
  }

  this.ensureIndex(function (err) {
    if (err) throw err;
    doReadEntry();
  });
};

/**/
TarIndex.readIndex = function (indexPath, cb) {
  var buffer = fs.readFileSync(indexPath);
  if (buffer.length % 8 !== 0) {
    throw "Invalid index file";
  }

  var entryIndex = 0;
  var entries = [];
  while (entryIndex <= buffer.length/8-1) {
    var start = buffer.readUInt32LE(entryIndex * 8);
    var size = buffer.readUInt32LE(entryIndex * 8 + 4);
    entries.push([start * 512, size]);
    entryIndex++;
  }
  cb(null, entries);
};


function readRange(file, buffer, from, length, cb) {
  console.log('read range ', file, from, length);
  fs.open(file, 'r', function (err, fd) {
    fs.read(fd, buffer, 0, length, from, function (err, bytes) {
      fs.close(fd);
      cb(null, bytes, buffer);
    });
  });
}

function parsePartName(name) {
  var nameParts = name.split('-');
  return {
    tarname: nameParts.shift(),
    part: parseInt(nameParts.shift(), 10)
  };
}

module.exports = TarIndex;