var jwt = require('jwt-simple');

module.exports = function(server,db) {

    server.set("jwtTokenSecret", "jwtIsAwesomeIndeedNoQuestionAboutIt");

    function jwtTokenAuthenticator(req, res, next) {
        var token = (req.body && req.body.access_token)
            || (req.query && req.query.access_token)
            || req.headers['x-access-token'];


        if (token) {
            try {
                var decoded = jwt.decode(token, server.get('jwtTokenSecret'));

                if (decoded.exp <= Date.now()) {
                    return res.json(400, { error: "Access token has expired" });
                } else {
					console.log(decoded);
					db.collections.user.findOne({Email: decoded.iss}, function (err, user){
						if (err)
                            return res.json(400, {error: "Invalid user id"});

                        if (!user)
                            return res.json(400, {error: "Invalid user id"});

                        req.user = user;
                        return next();
					});
                }

            } catch (err) {
                return res.json(400, {error: "Error parsing token"});
            }
        } else {
            return res.json(400, {error: "Missing token"});
        }
    }

    server.all("/api/users", jwtTokenAuthenticator);
    server.all("/api/users/*", jwtTokenAuthenticator);
    server.all("/api/pois", jwtTokenAuthenticator);
    server.all("/api/events", jwtTokenAuthenticator);
    server.all("/api/events/*", jwtTokenAuthenticator);
};
