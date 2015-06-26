// app/routes.js
var async = require("async");
var accounting = require("accounting");
var crypto = require('crypto-js');
var moment = require('moment');
var request = require('request');
var shortId = require('shortid');
var _ = require('lodash');

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
        currency: user.currency,
        avatar: user.avatar || defaultAvatar
    };

    if (facebookAccount)
        ret.facebookAccount = facebookAccount;

    if (googleAccount)
        ret.googleAccount = googleAccount;

    return ret;
}

module.exports = function (server, passport, fx, jwt) {
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


    // POST /api/login/local
    server.post('/api/login/local', function (req, res) {

        passport.authenticate('local-login', function (err, user, info) {

            if (!user)
                return res.json(401, info);

            req.logIn(user, function (err) {

                if (err)
                    return res.send(401);

                var expires = moment().add('days', 7).valueOf();
                var token = generateToken(user.id, expires);
                res.send(200, {
                    access_token: token,
                    exp: expires,
                    user: protected_user_info(user)
                });
            });
        })(req, res);

    });

    // POST /api/signup/local
    server.post('/api/signup/local', function (req, res, next) {

        passport.authenticate('local-signup', function (err, user, info) {

            if (!user)
                return res.json(401, info);

            req.logIn(user, function (err) {

                if (err)
                    return res.send(401);

                var expires = moment().add('days', 7).valueOf();
                var token = generateToken(user.id, expires);
                res.send(200, {
                    access_token: token,
                    exp: expires,
                    user: protected_user_info(user)
                });
            });
        })(req, res, next);

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

                    req.models.facebook.get(profile.id, function (err, facebookUser) { // login attempt

                        if (err || !facebookUser) {
                            return callback({ error: "User not found" });
                        }

                        facebookUser.getLocalAccount(function (err, localUser) {

                            if (err)
                                return callback({ error: "Local user not found" });

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
                                        email: profile.email,
                                        access_token: req.body.token
                                    }
                                }};

                            facebookUser.save({token: req.body.token}, function(err) {
                                return callback(null, ret);
                            });
                        });
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

    // POST /api/users/:id/connect/facebook
    server.post('/api/users/:id/connect/facebook', function (req, res, next) {

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

                    request('https://graph.facebook.com/me?access_token=' + req.body.token, function (error, response, body) {

                        if (error || response.statusCode != 200) {
                            return callback({ error: "Invalid facebook access token" });
                        }

                        var profile = JSON.parse(body);
                        if (profile.verified === false)
                            return callback({ error: "Facebook account not verified" });

                        req.models.facebook.exists({ id: profile.id }, function (err, exists) {

                            if (err || exists)
                                return callback({ error: "Facebook account is already in use" });

                            if (!profile.displayName)
                                profile.displayName = profile.first_name + " " + profile.last_name;

                            req.models.user.get(req.user.id, function (err, localUser) {
                                if (err)
                                    return callback({error: "User '" + req.user.id + "' does not exist"});

                                localUser.hasFacebookAccount(function (err, facebookAccountExists) {

                                    if (err || facebookAccountExists)
                                        return callback({error: "User '" + req.user.id + "' already has a connected facebook account"});

                                    req.models.facebook.create({
                                        id: profile.id,
                                        token: req.body.token,
                                        displayName: profile.displayName,
                                        email: profile.email,
                                        localaccount_id: localUser.id,
                                        avatar: profilePicture.data.url
                                    }, function (err, newFacebookUser) {

                                        if (err || !newFacebookUser)
                                            return callback({ error: "Failed to create new facebook account"});

                                        localUser.setFacebookAccount(newFacebookUser, function (err) {

                                            if (err) {
                                                return callback({ error: "User '" + req.user.id + "' already has a connected facebook account" });
                                            }

                                            var ret = {
                                                user: {
                                                    id: localUser.id,
                                                    email: localUser.email,
                                                    avatar: localUser.avatar,
                                                    currency: localUser.currency,
                                                    facebookAccount: {
                                                        email: newFacebookUser.email,
                                                        access_token: newFacebookUser.token,
                                                        avatar: newFacebookUser.avatar
                                                    }
                                                }
                                            };

                                            return callback(null, ret);
                                        });

                                    });
                                });

                            });
                        });
                    });
                }
            ],
            function (err, result) {

                if (err)
                    return res.json(401, err);

                return res.json(200, result);
            }
        );
    });

    // DELETE /api/users/:id/connect/facebook
    server.del('/api/users/:id/connect/facebook', function(req, res, next) {

        req.models.user.get(req.user.id, function(err, localUser) {

            if (err || !localUser)
                return res.json(400, { error: "User '" + req.user.id + "' does not exist" });

            localUser.removeFacebookAccount(function (err) {

                if (err)
                    return res.json(400, { error: "User '" + req.user.id + "' does not have a facebook account" });

                return res.json(204);
            });
        })
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

    // DELETE /api/users/:id/connect/google
    server.del('/api/users/:id/connect/google', function (req, res) {

        req.models.user.get(req.user.id, function(err, localUser) {

            if (err || !localUser)
                return res.json(400, { error: "User '" + req.user.id + "' does not exist" });

            localUser.removeGoogleAccount(function (err) {

                if (err)
                    return res.json(400, { error: "User '" + req.user.id + "' does not have a google account" });

                return res.json(204);
            });
        });
    });

    // GET /api/exchangeRates
    server.get('/api/exchangeRates', function (req, res) {

        return res.json(200, {
            base: fx.base,
            rates: fx.rates
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

        if (req.body.email === undefined && req.body.currency == undefined && req.body.avatar == undefined && req.body.password == undefined) {
            return res.json(409, {error: "Can only change 'email', 'currency', 'avatar' or 'password' attributes of the user."});
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

            if (req.body.currency) {
                updateObj.currency = req.body.currency;
            }

            if (req.body.avatar) {
                updateObj.avatar = req.body.avatar;
            }

            if (req.body.password) {
                updateObj.passwordHash = req.body.password;
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

    // GET /api/users/{id}/debts/{debtId}
    server.get('/api/users/:id/debts/:debtId', function (req, res) {

        req.models.user.get(req.params.id, function (err, user) {

            if (err || !user) {
                res.json(404, {error: "User '" + req.params.id + "' does not exist" });
                return;
            }

            user.getDebts().find({ id: req.params.debtId }, function (err, debts) {

                if (err || debts.length === 0) {
                    res.json(404, { error: "Debt '" + req.params.debtId + "' does not exist" });
                    return;
                }

                var debt = debts[0];
                var ret = {
                    description: debt.description,
                    debtId: debt.id,
                    creditor: debt.creditor_id,
                    debtor: debt.debtor_id,
                    created: debt.created,
                    modified: debt.modified
                };

                var currency = req.query.currency || debt.currency;

                ret.originalValue = convertMoney(debt.originalValue, debt.currency, currency);
                ret.value = convertMoney(debt.value, debt.currency, currency);
                ret.currency = req.query.currency;

                res.json(200, ret);
            });
        });

    });

    // PATCH /api/users/{id}/debts/{debtId}
    server.patch('/api/users/:id/debts/:debtId', function (req, res, next) {

        if (req.body === undefined) {
            return res.json(409, {error: "No body defined."});
        }

        if (isNaN(req.body.value)) {
            return res.json(409, {error: "Attribute 'value' needs to be a number."});
        }

        req.models.user.exists({ id: req.params.id }, function (err, exists) {

            if (err || !exists) {
                res.json(404, { error: "User '" + req.params.id + "' does not exist" });
                return;
            }

            req.models.debt.get(req.params.debtId, function (err, debt) { // get the debt instance

                if (err || !debt) {
                    return res.json(404, {error: "User '" + req.params.debtId + "' does not exist"});
                }

                if (req.body.value !== undefined) {
                    debt.value = req.body.value;
                    debt.currency = req.body.currency;
                }

                if (req.body.description) {
                    debt.description = req.body.description;
                }

                debt.save(function (err) { // update the debt instance

                    if (err)
                        return res.json(500, err);

                    res.json(200, {
                        debtId: debt.id,
                        creditor: debt.creditor_id,
                        debtor: debt.debtor_id,
                        originalValue: debt.originalValue,
                        value: debt.value,
                        currency: debt.currency,
                        created: debt.created,
                        modified: debt.modified,
                        description: debt.description
                    });
                });
            });
        });

    });

    // DELETE /api/users/{id}/debts/{debtId}
    server.del('/api/users/:id/debts/:debtId', function (req, res) {
        req.models.user.exists({ id: req.params.id }, function (err, exists) {
            if (err || !exists) {
                res.json(404, { error: "User '" + req.params.id + "' does not exist"});
                return;
            }

            req.models.debt.get(req.params.debtId, function (err, debt) {
                if (err)
                    return res.json(404, { error: "Debt '" + req.params.debtId + "' does not exist" });

                debt.remove(function (err) {
                    if (err)
                        return res.json(500, { error: "Could not remove debt '" + req.params.debtId + "': " + err });
                    res.send(204);
                });
            });
        });
    });

    // GET /api/users/{id}/debts
    server.get('/api/users/:id/debts', function (req, res) {

        var currency = req.query.currency ? req.query.currency : req.user.currency;

        req.models.user.get(req.params.id, function (err, user) {

            if (err || !user)
                return res.json(404, { error: "User '" + req.params.id + "' does not exist" });

            user.getCredits(function (err, credits) {
                if (err || !credits)
                    return res.json(500, err);

                user.getDebts(function (err, debts) {
                    if (err || !debts)
                        return res.json(500, err);

                    debts = credits.concat(debts);

                    async.reduce(debts, { credit: 0, debit: 0}, function (memo, debt, cb) {
                        var val = convertMoney(debt.value, debt.currency, currency);
                        if (user.id === debt.creditor_id) {
                            memo.credit += val;
                        } else {
                            memo.debit += val;
                        }

                        cb(null, memo);
                    }, function (err, values) {
                        var balance = values.credit - values.debit;

                        async.map(debts, asyncDebtConversion.bind(undefined, req.query.currency), function (err, debtsConverted) {
                            if (err)
                                return res.json(500, err);

                            var debtsData = {
                                total: debtsConverted.length,
                                balance: values.credit - values.debit,
                                credit: values.credit,
                                debit: values.debit,
                                currency: currency,
                                debts: debtsConverted
                            };

                            async.each(debtsData.debts, function (debt, callback) {
                                req.models.user.get(debt.creditor, function (err, creditor) {
                                    if (!err)
                                        debt.creditorAvatar = creditor.avatar;

                                    req.models.user.get(debt.debtor, function (err, debtor) {
                                        if (!err)
                                            debt.debtorAvatar = debtor.avatar;

                                        callback(null);
                                    })
                                });
                            }, function (err) {
                                res.json(debtsData);
                            });
                        });
                    });
                });
            });
        });
    });

    // POST /api/users/{id}/debts
    server.post('/api/users/:id/debts', function (req, res, next) {

        if (req.body === undefined) {
            return res.json(409, {error: "No body defined."});
        }

        if (req.body.user === undefined) {
            return res.json(409, {error: "Attribute 'user' is missing."});
        }

        if (req.body.value === undefined) {
            return res.json(409, {error: "Attribute 'value' is missing."});
        }

        if (!req.body.currency)
            return res.json(409, {error: "Attribute 'currency' is missing"});

        if (isNaN(req.body.value)) {
            return res.json(409, {error: "Attribute 'value' needs to be a number."});
        }

        req.models.user.exists({ id: req.params.id }, function (err, exists) {

            if (err) {
                res.json(500, err);
                return;
            }

            if (!exists) {
                res.json(404, {error: "User '" + req.params.id + "' does not exist" });
                return;
            }

            req.models.user.exists({ id: req.body.user }, function (err, exists) {

                if (err)
                    return res.json(500, err);

                if (!exists)
                    return res.json(404, {error: "User '" + req.body.user + "' does not exist" });

                var description = "";
                if (req.body.description)
                    description = req.body.description;

                req.models.debt.create({

                    creditor_id: req.params.id,
                    debtor_id: req.body.user,
                    originalValue: req.body.value,
                    description: req.body.description || '',
                    value: req.body.value,
                    currency: req.body.currency,
                    description: description

                }, function (err, debt) {

                    if (err || !debt)
                        return res.json(500, err);

                    res.json(201, {
                        debtId: debt.id,
                        creditor: debt.creditor_id,
                        debtor: debt.debtor_id,
                        originalValue: debt.originalValue,
                        value: debt.value,
                        description: debt.description,
                        currency: debt.currency,
                        created: debt.created,
                        modified: debt.modified,
                        description: debt.description
                    });

                });
            });
        });

    });

    // GET /api/users/{id}/friends/{friendId}
    server.get('/api/users/:id/friends/:friendId', function (req, res) {

        req.models.user.get(req.params.id, function (err, user) {
            if (err) {
                res.json(404, { error: "User '" + req.params.id + "' does not exist" });
                return;
            }

            user.getFriends({ id: req.params.friendId }, function (err, friends) {

                if (err || friends.length === 0) {
                    res.json(404, { error: "User '" + req.params.friendId + "' is not a friend" });
                    return;
                }

                res.json(200, { id: friends[0].id });
            });
        });

    });

    // DELETE /api/users/{id}/friends/{friendId}
    server.del('/api/users/:id/friends/:friendId', function (req, res) {

        req.models.user.get(req.params.id, function (err, me) {

            if (err) {
                res.json(500, err);
                return;
            } else if (!me) {
                res.json(404, { error: "User (me) '" + req.body.id + "' does not exist." });
                return;
            }

            // check if the friend exists
            req.models.user.get(req.params.friendId, function (err, friend) {

                if (err) {
                    res.json(500, err);
                    return;
                } else if (!friend) {
                    res.json(404, { error: "User (friend) '" + req.body.id + "' does not exist." });
                    return;
                }

                me.removeFriends([friend], function (err) {
                    if (err) {
                        res.json(500, err);
                        return;
                    }

                    res.send(204);
                });
            });
        });

    });

    // GET /api/users/{id}/friends
    server.get('/api/users/:id/friends', function (req, res) {

        req.models.user.get(req.params.id, function (err, me) {
            if (err) {
                res.json(500, err);
                return;
            } else if (!me) {
                res.json(404, { error: "User (me) '" + req.body.id + "' does not exist." });
                return;
            }

            me.getFriends(function (err, friends) {
                if (err) {
                    res.json(500, err);
                    return;
                } else if (!friends) {
                    res.json(404, { error: "Friends does not exist." });
                    return;
                }

                friends = friends.map(public_user_info);

                var obj = {
                    "total": friends.length,
                    "friends": friends
                };

                return res.json(200, obj);
            });
        });
    });

    // GET /api/users/{id}/friends/facebook
    server.get('/api/users/:id/friends/facebook', function (req, res) {

        req.models.user.get(req.params.id, function (err, me) {
            if (err) {
                res.json(500, err);
                return;
            } else if (!me) {
                res.json(404, { error: "User (me) '" + req.body.id + "' does not exist." });
                return;
            }

            me.getFriends(function (err, friends) {
                if (err) {
                    res.json(500, err);
                    return;
                } else if (!friends) {
                    res.json(404, { error: "Friends does not exist." });
                    return;
                }

                friends = friends.map(public_user_info);

                var obj = {
                    "total": friends.length,
                    "friends": friends
                };

                return res.json(200, obj);
            });
        });
    });

    // POST /api/users/{id}/friends
    server.post('/api/users/:id/friends', function (req, res, next) {

        if (req.body === undefined) {
            return res.json(409, {error: "No body defined."});
        }

        if (req.body.id === undefined) {
            return res.json(409, {error: "Attribute 'id' is missing."});
        }

        req.models.user.get(req.params.id, function (err, me) {

            if (err) {
                res.json(500, err);
                return;
            } else if (!me) {
                res.json(404, { error: "User (me) '" + req.body.id + "' does not exist." });
                return;
            }

            // check if the friend exists
            req.models.user.get(req.body.id, function (err, friend) {

                if (err) {
                    res.json(500, {error: err});
                    return;
                } else if (!friend) {
                    res.json(404, {error: "User (friend) '" + req.body.id + "' does not exist."});
                    return;
                }

                me.addFriends([friend], { date: new Date() }, function (err) {
                    if (err) {
                        res.json(500, err);
                        return;
                    }

                    res.json(201, { id: friend.id });
                });
            });
        });

    });

    // DELETE /api/users/{id}/friends
    server.del('/api/users/:id/friends', function (req, res) {

        req.models.user.get(req.params.id, function (err, me) {
            if (err) {
                res.json(500, err);
                return;
            } else if (!me) {
                res.json(404, { error: "User (me) '" + req.body.id + "' does not exist." });
                return;
            }

            me.setFriends([], function (err) {
                if (err) {
                    res.json(500, err);
                    return;
                }

                res.send(204);
            });
        });

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

        if (req.body.passwordHash === undefined) {
            return res.json(409, {error: "Attribute 'passwordHash' is missing"});
        }

        if (req.body.currency === undefined) {
            return res.json(409, {error: "Attribute 'currency' is missing"});
        }

        req.models.user.create({
            id: req.body.id,
            passwordHash: req.body.passwordHash,
            email: req.body.email,
            currency: req.body.currency,
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

    function asyncDebtConversion(currency, debt, callback) {

        if (!currency)
            currency = debt.currency;

        return callback(null, {
            debtId: debt.id,
            description: debt.description,
            creditor: debt.creditor_id,
            creditorAvatar: defaultAvatar,
            debtor: debt.debtor_id,
            debtorAvatar: defaultAvatar,
            originalValue: convertMoney(debt.originalValue, debt.currency, currency),
            value: convertMoney(debt.value, debt.currency, currency),
            currency: currency,
            created: debt.created,
            modified: debt.modified,
            description: debt.description
        });
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

    function convertMoney(value, srcCurrency, destCurrency) {
        // TODO: remove use of parseFloat
        return parseFloat(accounting.toFixed(fx(value).from(srcCurrency).to(destCurrency), 4));
    }

    function generateToken(userId, expirationDate) {
        var token = jwt.encode({
            iss: userId,
            exp: expirationDate
        }, server.get('jwtTokenSecret'));

        return token;
    }
};
