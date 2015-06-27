var mongoose = require('mongoose');

//Connect to server
mongoose.connect('mongodb://porto:meet@ds063779.mongolab.com:63779/portomeet');

var collections = {};

collections.user = mongoose.model('User', new mongoose.Schema({
	Name: String,
	FaceID: String,
	GoogleID: String,
	Email: String,
	Avatar: String,
	Position: {Lat: Number , Long: Number},
	Notifications: [{Text: String, Position:{Lat: Number, Long: Number}}],
	CurrentEvent: String
}));
		
collections.event = mongoose.model('Event', new mongoose.Schema({
	Name: String,
	Pass: String,
	Admin: [{ type : mongoose.Schema.ObjectId, ref: 'User'}],
	Attendants: [String]
}));

exports.collections = collections;
