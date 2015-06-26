var mongoose = require('mongoose');

module.exports = function (collections) {
	//Connect to server
	mongoose.connect('mongodb://porto:meet@ds063779.mongolab.com:63779/portomeet');
	
	var db = mongoose.connection;
	
	//Error Handler
	db.on('error', console.error.bind(console, 'connection error:'));

	db.once('open', function (callback) {
		// yay!

		var user = mongoose.model('User', new mongoose.Schema({
			Id: mongoose.Types.ObjectId,
			FaceID: String,
			GoogleID: String,
			Email: String
		}));
				
		var event = mongoose.model('Event', new mongoose.Schema({
			Name: String,
			Pass: String,
			Admin: { type : mongoose.Types.ObjectId, ref: 'User'},
			Attendants: [{ type : mongoose.Types.ObjectId, ref: 'User'}]
		}));
		
		collections.user = user;
		collections.event = event;	

	});
}