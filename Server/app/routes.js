// app/routes.js
var async = require("async");
var crypto = require('crypto-js');
var moment = require('moment');
var request = require('request');
var shortId = require('shortid');
var _ = require('lodash');
var mongoose = require('mongoose');

var defaultAvatar = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mm&f=y';
var facebookEndpoint = "https://graph.facebook.com/me?access_token=";
var googleEndpoint = "https://www.googleapis.com/oauth2/v2/userinfo?access_token=";
var API_KEY = "hackacityporto2015_server";

function public_user_info(user) {
    return {
        id: user.id,
        avatar: user.avatar || defaultAvatar
    }
}

function protected_user_info(user, facebookAccount, googleAccount) {

    var ret = {
        id: user.id,
        email: user.email,
        avatar: user.avatar || defaultAvatar
    };

    if (facebookAccount)
        ret.facebookAccount = facebookAccount;

    if (googleAccount)
        ret.googleAccount = googleAccount;

    return ret;
}

module.exports = function (server, passport, db, jwt) {
    //server.all("/api/", validChecksum);
    //server.all("/api/*", validChecksum);

    // GET /api/
    server.get("/api/", function (req, res) {
        res.send(204);
    });
	
	// POST /api/login/facebook
    server.post('/api/login/facebook', function (req, res, next) {

        if (!req.body.token) {
            return res.json(400, {error: 'Missing facebook token'});
        }

        async.waterfall([
            function (callback) {

                request(facebookEndpoint + req.body.token + "&fields=picture.type(large)", function (error, response, body) {

                    if (error || response.statusCode != 200)
                        return callback(null, {error: "Invalid facebook access token"});

                    var picture = JSON.parse(body).picture;
                    callback(null, picture); // picture : {data: url }
                });

            },
            function (profilePicture, callback) {
                request(facebookEndpoint + req.body.token, function (error, response, body) {

                    if (error || response.statusCode != 200) {
                        return callback({ error: "Invalid facebook access token" });
                    }

                    var profile = JSON.parse(body);

                    if (profile.verified === false)
                        return callback({ error: "Facebook account not verified" });
					
					db.collections.user.findOne({Email: profile.email}, function (err, user){
						if(err){
							console.log(err);
							return callback(err);
						}
						else if(!user){
							user = new db.collections.user({
								Name: profile.name,
								FaceID: profile.id, 
								GoogleID: "",
								Email: profile.email, 
								Avatar: profilePicture.data.url,
								Position: {Lat: 0, Long: 0},
								CurrentEvent: "",
								Notifications: []
							});
							user.save(function (err, result){
								if(err)
									console.log(err);
							});
						}else{
							user.FaceID = profile.id;
							user.save(function (err, result){
								if(err)
									console.log(err);
							});
						}
						
						var expires = moment().add('days', 7).valueOf();
                        var token = generateToken(profile.email, expires);
						var ret = {
                            access_token: token,
							user: user
                        };
						callback(null,ret);
					});
                });
            }
        ], function (err, result) {
            if (err)
                return res.json(400, err);
			
            res.json(200, result);
        });
    });

    // POST /api/login/google
    server.post('/api/login/google', function (req, res, next) {

        if (!req.body.token) {
            return res.json(401, {error: 'Missing google token'});
        }

		async.waterfall([
			function (callback){
				request(googleEndpoint + req.body.token, function (error, response, body) {
					if (error || response.statusCode != 200) {
						return res.json(400, { error: "Invalid google access token" });
					}

					var profile = JSON.parse(body);
					
					if (profile.verified_email === false)
						return res.json(400, { error: "Google account not verified" });
					
					db.collections.user.findOne({Email: profile.email}, function (err, user){
						if(err){
							console.log(err);
							return callback(err);
						}
						else if(!user){
							user = new db.collections.user({
								Name: profile.name,
								GoogleID: profile.id, 
								FaceID: "",
								Email: profile.email, 
								Avatar: profile.picture,
								Position: {Lat: 0, Long: 0},
								CurrentEvent: "",
								Notifications: []
							});
							user.save(function (err, result){
								if(err)
									console.log(err);
							});
						}else{
							user.GoogleID = profile.id;
							user.save(function (err, result){
								if(err)
									console.log(err);
							});
						}
						
						var expires = moment().add('days', 7).valueOf();
                        var token = generateToken(profile.email, expires);
						var ret = {
                            access_token: token,
							user: user
                        };
						callback(null,ret);
					});
					
				});
			}
		], function (err, result) {
            if (err)
                return res.json(400, err);
			
            res.json(200, result);
        });
    });

	// POST /api/event
    server.post('/api/events', function(req, res, next){
        if (req.body === undefined) {
            return res.json(409, {error: "No body defined"});
        }

        if (req.body.name === undefined) {
            return res.json(409, {error: "Attribute 'name' is missing."});
        }

        if (req.body.password === undefined) {
            return res.json(409, {error: "Attribute 'password' is missing."});
        }
        
         db.collections.event.find({Name: req.body.name}, function(err, e){
            if(err){
               return res.json(500, err);
            } else if(!e || e.length == 0){
                var newEvent = new db.collections.event({Name: req.body.name,Pass: req.body.password, Admin: [req.user.id], Attendants: []});
        
                newEvent.save(function(err, newEvent){
                    if (err)
                        return res.json(500, err);
                    else
                        return res.json(201, newEvent);
                });
            } else {
                return res.json(409, {error: "Event with the same name already exists."});
            }
        });
    });
    
	// DELETE /api/event/{:name}
	server.delete('/api/events/:name', function(req, res, next){
		db.collections.event.find({Name: req.params.name}, function(err, e){
			if(err){
				return res.json(500, err);
			}else{
				if(e.Admin === user._id){
					db.collections.event.remove(e, function(err, result){
						if(err){
							console.log("Error deleting event from database");
							return res.json(500,err);
						}
						else{
							return res.json(200, result);
						}
					});
				}
			}
		});
	});
	
	// POST /api/event/join
    server.post('/api/events/join', function(req, res){
        if (req.body === undefined) {
            return res.json(409, {error: "No body defined"});
        }

        if (req.body.name === undefined) {
            return res.json(409, {error: "Attribute 'name' is missing."});
        }

        if (req.body.password === undefined) {
            return res.json(409, {error: "Attribute 'password' is missing."});
        }
        
        db.collections.event.find({Name: req.body.name}, function(err, e){
            if(err){
               return res.json(500, err);
            } else if(!e){
               return res.json(409, {error: "Event not found."});
            }
            
            if(e.Pass !== req.body.password){
               return res.json(409, {error: "Wrong event password."});
            }
            
            if (!(e.Attendants.indexOf(req.user.id) > -1)) {
                e.Attendants.push(req.user.id);
                e.save(function(err, res){
                    if (err) 
                        return res.json(500, err);
                });
            }
                   
            db.collections.user.find({Name: req.user.name},function(err, u){
                if(err){
                    return res.json(500, err); 
                }
                
                if(!u){
                    return res.json(409, {error: "User not found."});
                }
                
                u.CurrentEvent = req.body.name;
                u.save(function(err, res){
                    if (err) 
                        return res.json(500, err);
                    else
                        return res.json(200, u);
                });
            });
        });
    });
    
	// POST /api/event/leave
    server.post('/api/events/leave', function(req, res){
        if (req.body === undefined) {
            return res.json(409, {error: "No body defined"});
        }

        if (req.body.name === undefined) {
            return res.json(409, {error: "Attribute 'name' is missing."});
        }
        
        db.collections.event.find({Name: req.body.name}, function(err, e){
            if(err){
               return res.json(500, err);
            } else if(!e){
               return res.json(409, {error: "Event not found."});
            }
            
            var i = e.Attendants.indexOf(req.user.id);
            if (i > -1) {
                e.Attendants.splice(i, 1);
                e.save(function(err, res){
                    if (err) 
                        return res.json(500, err);
                });
            }
            
            db.collections.user.find({Name: req.user.name},function(err, u){
                if(err){
                    return res.json(500, err); 
                }
                
                if(!u){
                    return res.json(409, {error: "User not found."});
                }
                
                u.CurrentEvent = "";
                u.save(function(err, res){
                    if (err) 
                        return res.json(500, err);
                    else
                        return res.json(200, u);
                });
            });
        });
    });
    
	// POST /api/event/{id}/notification
    server.post('/api/events/:id/notification', function (req, res, next) {
		var name = req.params.id;
		var text = req.body.message;
		var location = JSON.parse(req.body.location);
		var message = {"Text": text, "Position": location};
		db.collections.user.find({CurrentEvent: id}, {active:false} , {multi: true} , function(err, user) {
			if(!err) {
				user.Notifications.push(message);
				user.save(function(err) {
					if(!err) {
						return res.json(500, {"Error":"Bad query"});
					}
					else {
						return res.json(200, {"Success":"True"});
					}
				});
            }
        });
    });
     
	// DELETE /api/user/{id}/notification
	server.delete('/api/users/:id/notification', function(req,res,next){
		var email = req.params.id;
		db.collections.user.findOne({Email: email}, function (err, user){
			if(err){
				return res.json(500, {"Error":"Bad query", "Reason": err});
			}else{
				user.Notifications.pull(0);
				user.save();
				return res.json(200, {"Success":"True"});
			}
		});
	});      
		
	// GET /api/pois
    server.get('/api/pois/', function (req, res, next) {
        var lat = req.query.lat;
        var long = req.query.long;
        var cat = req.query.cat;
        var range = req.query.range;
        console.log(lat);
        if(lat && long && cat && range){
         var query = "https://api.ost.pt/pois/?category="+cat+"&center="+lat+"%2C"+long+"&range="+range+"&key="+API_KEY;
         console.log(query);
         request(query, function(err, response, body) {
             
             res.json(JSON.parse(body).Objects);
         });   
        }
        else{
            return res.json(500, {"Error":"Bad query"});
        }
    });
    
	// POST /api/user/
    server.post('/api/users/:id/location', function (req, res, next) {
       var email = req.params.id;
       var lat = req.body.lat;
       var long = req.body.long;
         db.collections.user.findOne({Email: email}, function(err, user) {
            if(!err) {
                user.Position = {Lat: lat , Long: long};
                user.save(function(err) {
                    if(!err) {
                        return res.json(200, {"Success":"True"});
                    }
                    else {
                         return res.json(500, {"Error":"Bad query"});
                        
                    }
                });
            }
        });
    });
	
    // asynchronous version of the fuzzy evaluation function defined above
    function asyncFuzzyTest(searchTerm, user, callback) {
        var hay = user.id.toLowerCase(), i = 0, n = -1, l;
        searchTerm = searchTerm.toLowerCase();
        for (; l = searchTerm[i++];) {
            if (!~(n = hay.indexOf(l, n + 1))) {
                return callback(false);
            }
        }
        return callback(true);
    }

    function validChecksum(req, res, next) {

        var checksum = req.get("X-Checksum");
        if (!checksum) {
            return next("Missing X-Checksum header");
        }

        var obj = { url: req.params[0] || "/", query: req.query, body: req.body };

        var sign = crypto.HmacSHA1(JSON.stringify(obj), "all your base are belong to us").toString();
        if (sign !== checksum) {
            return next("Wrong X-Checksum");
        }

        return next();
    }

    function generateToken(userId, expirationDate) {
        var token = jwt.encode({
            iss: userId,
            exp: expirationDate
        }, server.get('jwtTokenSecret'));

        return token;
    }
};
