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
	   for (var index = 0; index < resp.length; index++) {
		  var element = resp[index];
		  collection.insert(element);
		  console.log("Inserted");
  	}
  });
});

var insertDocuments = function(callback) {
  var data = new Array();
  for (var index = 0; index < 7080; index+=25) {
    requestify.get('https://api.ost.pt/ngsi10/contextEntityTypes/pois/?key=hackacityporto2015_server&municipality=806&offset='+index)
    .then(function(response) {
  	  console.log("Inserted");
  	  data.push(response.getBody().contextResponses)
    });
  }
   callback(data);
}