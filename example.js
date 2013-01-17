var path = require('path');
var TarIndex = require('./');

var tarFile = 'my.tar';

var index = new TarIndex(path.join(__dirname, tarFile));

index.write(read);

function read() {
	index.readEntry(2, function (err, entry) {
		console.log(2, entry);
	});
	index.readEntry(3, function (err, entry) {
		console.log(3, entry);
	});
}
