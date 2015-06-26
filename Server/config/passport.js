// config/passport.js

var FacebookStrategy = require('passport-facebook').Strategy;
var GoogleStrategy = require('passport-google').Strategy;

// load the auth variables
var configAuth = require('./auth');

var crypto = require('crypto-js');

module.exports = function (passport) {

    passport.serializeUser(function (user, done) {
        done(null, user);
    });

    passport.deserializeUser(function (req, user, done) {

        req.models.user.get(user.id, function (err, user) {
            done(err, user);
        });

    });

    // Facebook strategies =============================================================================================

    // signup with facebook account
    passport.use("facebook-signup", new FacebookStrategy({
            clientID: configAuth.facebookAuth.clientID,
            clientSecret: configAuth.facebookAuth.clientSecret,
            callbackURL: configAuth.facebookAuth.signupCallbackURL,
            passReqToCallback: true
        },
        function (req, token, refreshToken, profile, done) {

            // asynchronous
            process.nextTick(function () {

                if (req.query.state) { // if set, it's a signup request

                    req.models.user.create({
                            id: req.query.state
                        },
                        function (err, newLocalUser) {

                            if (err) {
                                return done(err);
                            }

                            req.models.facebook.exists({ id: profile.id }, function (err, exists) {

                                if (err)
                                    return done(err);

                                if (exists)
                                    return done(null, false);

                                req.models.facebook.create({
                                        id: profile.id,
                                        token: token,
                                        displayName: profile.displayName,
                                        email: profile.emails[0].value,
                                        localaccount_id: newLocalUser.id
                                    },
                                    function (err, newFacebookUser) {

                                        if (err) {
                                            return done(err);
                                        }

                                        newLocalUser.setFacebookAccount(newFacebookUser, function (err) {
                                            if (err) {
                                                return done(err);
                                            }

                                            return done(null, newLocalUser);
                                        });

                                    });
                            });
                        });
                }
            });
        }));

    // login with facebook account
    passport.use("facebook-login", new FacebookStrategy({
            clientID: configAuth.facebookAuth.clientID,
            clientSecret: configAuth.facebookAuth.clientSecret,
            callbackURL: configAuth.facebookAuth.loginCallbackURL,
            passReqToCallback: true
        },
        function (req, token, refreshToken, profile, done) {

            req.models.facebook.get(profile.id, function (err, facebookUser) { // login attempt

                if (err)
                    return done(err);

                if (!facebookUser)
                    return done(null, false);

                facebookUser.getLocalAccount(function (err, localUser) {

                    if (err)
                        return done(err);

                    return done(null, localUser);
                });
            });

        }));

    // connect with facebook account
    passport.use("facebook-connect", new FacebookStrategy({
                clientID: configAuth.facebookAuth.clientID,
                clientSecret: configAuth.facebookAuth.clientSecret,
                callbackURL: configAuth.facebookAuth.connectCallbackURL,
                passReqToCallback: true
            },
            function (req, token, refreshToken, profile, done) {

                if (!req.user)
                    return done(null, false);

                var user = req.user;

                req.models.facebook.create({
                    id: profile.id,
                    token: token,
                    displayName: profile.displayName,
                    email: profile.emails[0].value,
                    localaccount_id: user.id

                }, function (err, newFacebookUser) {

                    if (err) {
                        return done(err);
                    }

                    user.setFacebookAccount(newFacebookUser, function (err) {
                        if (err) {
                            return done(err);
                        }

                        return done(null, user);
                    });

                });
            })
    );

    // Google strategies ===============================================================================================

    // signup with google account
    passport.use("google-signup", new GoogleStrategy({
            returnURL: configAuth.googleAuth.signupCallbackURL,
            realm: configAuth.googleAuth.realm,
            passReqToCallback: true
        },
        function (req, identifier, profile, done) {

            // asynchronous
            process.nextTick(function () {

                req.models.user.create({
                        id: req.query.state
                    },
                    function (err, newLocalUser) {

                        if (err) {
                            return done(err);
                        }

                        req.models.google.create({
                                id: identifier,
                                displayName: profile.displayName,
                                email: profile.emails[0].value,
                                localaccount_id: newLocalUser.id
                            },
                            function (err, newGoogleUser) {

                                if (err) {
                                    return done(err);
                                }

                                newLocalUser.setGoogleAccount(newGoogleUser, function (err) {
                                    if (err) {
                                        return done(err);
                                    }

                                    return done(null, newLocalUser);
                                });

                            });
                    });
            });
        }));

    // login with google account
    passport.use("google-login", new GoogleStrategy({
            returnURL: configAuth.googleAuth.loginCallbackURL,
            realm: configAuth.googleAuth.realm,
            passReqToCallback: true
        },
        function (req, identifier, profile, done) {

            req.models.google.get(identifier, function (err, googleUser) {

                if (err)
                    return done(err);

                if (!googleUser)
                    return done(null, false);

                googleUser.getLocalAccount(function (err, localUser) {

                    if (err)
                        return done(err);

                    return done(null, localUser);
                });
            });
        }));

    // connect google account
    passport.use("google-connect", new GoogleStrategy({
            returnURL: configAuth.googleAuth.connectCallbackURL,
            realm: configAuth.googleAuth.realm,
            passReqToCallback: true
        },
        function (req, identifier, profile, done) {

            if (!req.user)
                return done(null, false);

            var user = req.user;
            console.log(user.id);

            req.models.google.create({
                    id: identifier,
                    displayName: profile.displayName,
                    email: profile.emails[0].value,
                    localaccount_id: user.id
                },
                function (err, newGoogleUser) {

                    if (err)
                        return done(err);

                    user.setGoogleAccount(newGoogleUser, function (err) {

                        if (err)
                            return done(err);

                        return done(null, user);
                    });
                });
        }));
};
