var mongoose = require('mongoose');

//Connect to server
mongoose.connect('mongodb://porto:meet@ds063779.mongolab.com:63779/portomeet');

var db = mongoose.connection;
//Error handler
db.on('error', console.error.bind(console, 'connection error:'));

db.once('open', function (callback) {
  // yay!
	var kittySchema = mongoose.Schema({
		name: String
	});
	
	var Kitten = mongoose.model('Kitten', kittySchema);

});