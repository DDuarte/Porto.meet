var MongoClient = require('mongodb').MongoClient
  , assert = require('assert');
var requestify = require('requestify');
// Connection URL
var url = 'mongodb://porto:meet@ds063779.mongolab.com:63779/portomeet';
// Use connect method to connect to the Server
MongoClient.connect(url, function(err, db) {
  assert.equal(null, err);
  console.log("Connected correctly to server");
  var collection = db.collection('pointsofinterest');
  insertDocuments(function(resp) {
	  console.log(resp);
	   for (var index = 0; index < resp.contextResponses.length; index++) {
		  var element = resp.contextResponses[index].contextElement.attributes;
		  console.log(element);
		  collection.insert(element);
		  console.log("Inserted");
  	}
    db.close();
  });
});

var insertDocuments = function(callback) {
  requestify.get('https://api.ost.pt/ngsi10/contextEntityTypes/pois/?key=hackacityporto2015_server&municipality=806')
  .then(function(response) {
	  console.log("resp");
	  callback(response.getBody());
  });
}