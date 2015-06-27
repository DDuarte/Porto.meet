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

    // POST /api/users/{id}/facebook/friends
    server.post('/api/users/:id/facebook/friends', function (req, res, next) {

        if (req.user.id !== req.params.id)
            return res.json(401, { error: "No permission" });

        if (!req.body.token)
            return res.json(400, { error: "Missing facebook token" });

        var token = req.body.token;
        request("https://graph.facebook.com/me/friends?access_token=" + token, function(err, response, body) {

            var friends = JSON.parse(body).data;
            var numFriendsAdded = 0;
            req.models.user.get(req.user.id, function(err, localUser) {

                if (err || !localUser)
                    return res.json(401, { error: "Invalid user id" });

                async.each(friends, function (friend, callback) {

                    req.models.facebook.get(friend.id, function(err, facebookUser) {

                        if (err || !facebookUser)
                            return callback(null);

                        facebookUser.getLocalAccount(function(err, localFriend) {

                            if (err || !localFriend)
                                return callback(null);

                            localUser.addFriends([localFriend], { date: new Date() }, function (err) {
                                if (err)
                                    return callback(null);

                                ++numFriendsAdded;
                                return callback(null);
                            });
                        });
                    });

                }, function() { // this function is called when all the friends are processed
                    return res.json(200, {added: numFriendsAdded}); // return number of added friends
                });

            });
        });
    });

    // POST /api/users/{id}/google/friends
    server.post('/api/users/:id/google/friends', function (req, res, next) {

        if (req.user.id !== req.params.id)
            return res.json(401, { error: "No permission" });

        if (!req.body.token)
            return res.json(400, { error: "Missing google token" });

        var token = req.body.token;
        request("https://www.googleapis.com/plus/v1/people/me/people/visible?access_token=" + token, function(err, response, body) {

            if (err)
                return res.json(201, {error: err});

            var friends = JSON.parse(body).items;
            var numFriendsAdded = 0;
            req.models.user.get(req.user.id, function(err, localUser) {

                if (err || !localUser)
                    return res.json(401, { error: "Invalid user id" });

                async.each(friends, function (friend, callback) {

                    req.models.google.get(friend.id, function(err, googleUser) {

                        if (err || !googleUser)
                            return callback(null);

                        googleUser.getLocalAccount(function(err, localFriend) {

                            if (err || !localFriend)
                                return callback(null);

                            localUser.addFriends([localFriend], { date: new Date() }, function (err) {
                                if (err)
                                    return callback(null);

                                ++numFriendsAdded;
                                return callback(null);
                            });
                        });
                    });

                }, function() { // this function is called when all the friends are processed
                    return res.json(200, {added: numFriendsAdded}); // return number of added friends
                });

            });
        });
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
								FaceID: profile.id, 
								GoogleID: "",
								Email: profile.email, 
								Avatar: profilePicture.data.url,
								Position: {Lat: 0, Long: 0}
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
                        var token = generateToken(user.email, expires);
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

    // POST /api/signup/facebook
    server.post('/api/signup/facebook', function (req, res, next) {

        if (!req.body.token) {
            return res.json(401, {error: "Missing facebook token"});
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

                    request('https://graph.facebook.com/me?access_token=' + req.body.token, function (error, response, body) {

                        if (error || response.statusCode != 200) {
                            return callback({ error: "Invalid facebook access token" });
                        }

                        var profile = JSON.parse(body);

                        if (profile.verified === false)
                            return callback({ error: "Facebook account not verified" });

                        if (!profile.displayName)
                            profile.displayName = profile.first_name + " " + profile.last_name;

                        req.models.user.exists({email: profile.email}, function (err, exists) {

                            if (err || exists) {

                                req.models.user.find({email: profile.email}, function (err, results) {

                                    if (err || !results)
                                        return callback({error: "Internal Server error"});

                                    var localUser = results[0];

                                    req.models.facebook.create({
                                            id: profile.id,
                                            token: req.body.token,
                                            displayName: profile.displayName,
                                            email: profile.email,
                                            localaccount_id: localUser.id,
                                            avatar: profile.picture
                                        },
                                        function (err, newFacebookUser) {

                                            if (err || !newFacebookUser) {
                                                return callback({ error: "A Facebook account is already connected:" });
                                            }

                                            localUser.setFacebookAccount(newFacebookUser, function (err) {

                                                if (err) {
                                                    return callback({ error: err });
                                                }

                                                var expires = moment().add('days', 7).valueOf();
                                                var token = generateToken(localUser.id, expires);
                                                var ret = {
                                                    access_token: token,
                                                    user: {
                                                        id: localUser.id,
                                                        email: localUser.email,
                                                        avatar: localUser.avatar,
                                                        currency: localUser.currency,
                                                        facebookAccount: {
                                                            email: newFacebookUser.email,
                                                            access_token: newFacebookUser.token
                                                        }
                                                    }
                                                };

                                                return callback(null, ret);
                                            });

                                        });
                                });

                            } else {

                                req.models.facebook.exists({ id: profile.id }, function (err, exists) {

                                    if (err || exists)
                                        return callback({ error: "Facebook account is already registered" });

                                    req.models.user.exists({id: profile.displayName}, function (err, exists) {

                                        if (err || exists)
                                            profile.displayName = profile.displayName + '#' + shortId.generate();

                                        req.models.user.create({
                                            id: profile.displayName,
                                            email: profile.email,
                                            avatar: profilePicture.data.url
                                        }, function (err, localUser) {

                                            if (err || !localUser) {
                                                return callback({ error: err});
                                            }

                                            req.models.facebook.create({
                                                    id: profile.id,
                                                    token: req.body.token,
                                                    displayName: profile.displayName,
                                                    email: profile.email,
                                                    localaccount_id: localUser.id,
                                                    avatar: profilePicture.data.url
                                                },
                                                function (err, newFacebookUser) {

                                                    if (err || !newFacebookUser) {
                                                        return callback({ error: err });
                                                    }

                                                    localUser.setFacebookAccount(newFacebookUser, function (err) {

                                                        if (err) {
                                                            return callback({ error: err });
                                                        }

                                                        var expires = moment().add('days', 7).valueOf();
                                                        var token = generateToken(localUser.id, expires);
                                                        var ret = {
                                                            access_token: token,
                                                            user: {
                                                                id: localUser.id,
                                                                email: localUser.email,
                                                                avatar: localUser.avatar,
                                                                currency: localUser.currency,
                                                                facebookAccount: {
                                                                    email: newFacebookUser.email,
                                                                    access_token: newFacebookUser.token
                                                                }
                                                            }
                                                        };

                                                        return callback(null, ret);
                                                    });

                                                });
                                        });
                                    });
                                });

                            }

                        });

                    });

                }],
            function (err, result) {

                if (err)
                    return res.json(401, err);

                return res.json(200, result);
            });
    });

    // POST /api/login/google
    server.post('/api/login/google', function (req, res, next) {

        if (!req.body.token) {
            return res.json(401, {error: 'Missing google token'});
        }

        request(googleEndpoint + req.body.token, function (error, response, body) {

            if (error || response.statusCode != 200) {
                return res.json(400, { error: "Invalid google access token" });
            }

            var profile = JSON.parse(body);
            if (profile.verified_email === false)
                return res.json(400, { error: "Google account not verified" });

            req.models.google.get(profile.id, function (err, googleUser) { // login attempt

                if (err || !googleUser) {
                    return res.json(400, { error: "User not found" });
                }

                googleUser.getLocalAccount(function (err, localUser) {

                    if (err)
                        return res.json(400, { error: "Local user not found" });

                    var expires = moment().add('days', 7).valueOf();
                    var token = generateToken(localUser.id, expires);
                    var ret = {
                        access_token: token,
                        user: {
                            id: localUser.id,
                            email: localUser.email,
                            currency: localUser.currency,
                            avatar: localUser.avatar,
                            googleAccount: {
                                email: profile.email,
                                access_token: req.body.token
                            }
                        }};

                    googleUser.save({token: req.body.token}, function(err) {
                        return res.json(200, ret);
                    });
                });
            });
        });
    });

    // POST /api/signup/google
    server.post('/api/signup/google', function (req, res, next) {

        request(googleEndpoint + req.body.token, function (error, response, body) {

            if (error || response.statusCode != 200) {
                return res.json(401, { error: "Invalid google access token" });
            }

            var profile = JSON.parse(body);
            if (profile.verified_email === false)
                return res.json(401, { error: "Google account not verified" });

            if (!profile.displayName)
                profile.displayName = profile.given_name + " " + profile.family_name;

            req.models.user.exists({email: profile.email}, function (err, exists) {

                if (err)
                    return res.json(500, {error: JSON.stringify(err)})

                if (exists) { // if a local user is registered with the same email, link the accounts
                    req.models.user.find({email: profile.email}, function (err, results) {

                        if (err || !results)
                            return res.json(500, {error: "Internal Server error"});

                        var localUser = results[0];

                        req.models.google.create({
                                id: profile.id,
                                token: req.body.token,
                                displayName: profile.displayName,
                                email: profile.email,
                                localaccount_id: localUser.id,
                                avatar: profile.picture
                            },
                            function (err, newGoogleUser) {

                                if (err || !newGoogleUser) {
                                    return res.json(401, { error: "A Google account is already \connected" });
                                }

                                localUser.setGoogleAccount(newGoogleUser, function (err) {

                                    if (err) {
                                        return res.json(401, { error: err });
                                    }

                                    var expires = moment().add('days', 7).valueOf();
                                    var token = generateToken(localUser.id, expires);
                                    var ret = {
                                        access_token: token,
                                        user: {
                                            id: localUser.id,
                                            email: localUser.email,
                                            avatar: localUser.avatar,
                                            currency: localUser.currency,
                                            googleAccount: {
                                                email: newGoogleUser.email,
                                                access_token: newGoogleUser.token
                                            }
                                        }
                                    };

                                    return res.json(200, ret);
                                });

                            });
                    });
                }
                else {
                    req.models.google.exists({ id: profile.id }, function (err, exists) {

                        if (err || exists)
                            return res.json(401, { error: "Google account is already registered" });

                        req.models.user.exists({id: profile.displayName}, function (err, exists) {

                            if (err || exists)
                                profile.displayName = profile.displayName + '#' + shortId.generate();

                            req.models.user.create({
                                id: profile.displayName,
                                email: profile.email,
                                avatar: profile.picture
                            }, function (err, localUser) {

                                if (err || !localUser) {
                                    return res.json(401, { error: err});
                                }

                                req.models.google.create({
                                        id: profile.id,
                                        token: req.body.token,
                                        displayName: profile.displayName,
                                        email: profile.email,
                                        localaccount_id: localUser.id,
                                        avatar: profile.picture
                                    },
                                    function (err, newGoogleUser) {

                                        if (err || !newGoogleUser) {
                                            return res.json(401, { error: err });
                                        }

                                        localUser.setGoogleAccount(newGoogleUser, function (err) {

                                            if (err) {
                                                return res.json(401, { error: err });
                                            }

                                            var expires = moment().add('days', 7).valueOf();
                                            var token = generateToken(localUser.id, expires);
                                            var ret = {
                                                access_token: token,
                                                user: {
                                                    id: localUser.id,
                                                    email: localUser.email,
                                                    avatar: localUser.avatar,
                                                    currency: localUser.currency,
                                                    googleAccount: {
                                                        email: newGoogleUser.email,
                                                        access_token: newGoogleUser.token
                                                    }
                                                }
                                            };

                                            return res.json(200, ret);
                                        });

                                    });
                            });
                        });
                    });
                }
            });

        });
    });

    // GET /api/users/{id}
    server.get('/api/users/:id', function (req, res) {

        req.models.user.get(req.params.id, function (err, user) {

            if (err || !user) {
                res.json(404, { "error": "User " + req.params.id + " not found" });
                return;
            }

            if (!req.user || req.user.id !== user.id)
                return res.json(200, public_user_info(user));

            var protectedUser = protected_user_info(user);

            user.getFacebookAccount(function(err, facebookAccount) {

                if (!err && facebookAccount)
                    protectedUser.facebookAccount = {
                        id: facebookAccount.id,
                        email: facebookAccount.email,
                        token: facebookAccount.token,
                        avatar: facebookAccount.avatar
                    };

                user.getGoogleAccount(function(err, googleAccount) {

                    if (!err && googleAccount)
                        protectedUser.googleAccount = {
                            id: googleAccount.id,
                            email: googleAccount.email,
                            token: googleAccount.token,
                            avatar: googleAccount.avatar
                        };

                    return res.json(200, protectedUser);
                });
            });
        });
    });

    // PATCH /api/users/{id}
    server.patch('/api/users/:id', function (req, res, next) {

        if (req.body === undefined) {
            return res.json(409, {error: "No body defined."});
        }

        if (req.body.email === undefined && req.body.avatar == undefined) {
            return res.json(409, {error: "Can only change 'email' or 'avatar' attributes of the user."});
        }

        req.models.user.get(req.params.id, function (err, user) {
            if (err || !user) {
                res.json(404, { "error": "User " + req.params.id + " not found" });
                return;
            }

            var updateObj = {};
            if (req.body.email) {
                updateObj.email = req.body.email;
            }

            if (req.body.avatar) {
                updateObj.avatar = req.body.avatar;
            }

            user.save(updateObj, function (err) {
                if (err || !user) {
                    res.json(403, err);
                    return;
                }

                res.json(protected_user_info(user));
            });
        });

    });

    // DELETE /api/users/{id}
    server.del('/api/users/:id', function (req, res) {

        req.models.user.get(req.params.id, function (err, user) {

            if (err || !user) {
                res.json(404, { "error": "User " + req.param.id + " does not exist" });
                return;
            }

            user.remove(function (err) {

                if (err) {
                    res.json(500, err);
                    return;
                }

                res.json(204);
            });
        });

    });

    // GET /api/users/{id}/facebook
    server.get('/api/users/:id/facebook', function (req, res) {

        req.models.user.get(req.params.id, function (err, user) {

            if (err || !user)
                return res.json(404, { error: "User '" + req.params.id + "' does not exist" });

            user.getFacebookAccount(function (err, facebookAccount) {

                if (err)
                    return res.json(500, err);

                if (!facebookAccount)
                    return res.json(404, { error: "User '" + req.params.id + "' does not have a linked facebook account" });

                return res.json(200, {
                    provider: "facebook",
                    email: facebookAccount.email,
                    displayName: facebookAccount.displayName
                });
            })
        })
    });

    // GET /api/users/{id}/google
    server.get('/api/users/:id/google', function (req, res) {

        req.models.user.get(req.params.id, function (err, user) {

            if (err || !user)
                return res.json(404, { error: "User '" + req.params.id + "' does not exist" });

            user.getGoogleAccount(function (err, googleAccount) {

                if (err)
                    return res.json(500, err);

                if (!googleAccount)
                    return res.json(404, { error: "User '" + req.params.id + "' does not have a linked google account" });

                return res.json(200, {
                    provider: "google",
                    email: googleAccount.email,
                    displayName: googleAccount.displayName
                });
            })
        })
    });

    // GET /api/users
    server.get('/api/users', function (req, res) {
        req.models.user.find({}).run(function (err, users) {
            if (err) {
                res.json(500, err);
                return;
            }

            users = users.map(public_user_info);

            var removeSelf = req.query.self !== undefined && req.query.self == 'false';

            if (!req.query.search) {
                if (removeSelf) {
                    users = _.remove(users, function (user) {
                        return req.user.id !== user.id;
                    });
                }

                res.json({
                    total: users.length,
                    users: users
                });
            } else {
                var fuzzyTest = asyncFuzzyTest.bind(undefined, req.query.search);
                async.filter(users, fuzzyTest, function (results) { // asynchronous search
                    if (removeSelf) {
                        results = _.remove(results, function (user) {
                            return req.user.id !== user.id;
                        });
                    }

                    res.json({
                        total: results.length,
                        users: results
                    });
                });
            }
        });
    });

    // POST /api/users
    server.post('/api/users', function (req, res, next) {
        if (req.body === undefined) {
            return res.json(409, {error: "No body defined"});
        }

        if (req.body.id === undefined) {
            return res.json(409, {error: "Attribute 'id' is missing."});
        }

        if (req.body.email === undefined) {
            return res.json(409, {error: "Attribute 'email' is missing."});
        }

        if (!/\S+@\S+\.\S+/.test(req.body.email)) {
            return res.json(409, {error: "Attribute 'email' is not a valid email address."});
        }

        req.models.user.create({
            id: req.body.id,
            email: req.body.email,
            avatar: req.body.avatar // can be empty
        }, function (err, user) {
            if (err) {
                if (err.code == 23505) { // unique_violation
                    return next("Already exists");
                } else if (err.msg == "invalid-password-length" || err.msg == "invalid-email-format") {
                    return next(err.msg);
                } else {
                    res.json(500, err);
                }
            }

            res.json(201, protected_user_info(user));
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
