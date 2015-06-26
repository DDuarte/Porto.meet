// server.js

// set up ======================================================================
// get all the tools we need

var express = require('express'),
    morgan  = require('morgan'),
    compress = require('compression'),
    bodyParser = require('body-parser'),
    cookieParser = require('cookie-parser'),
    session = require('express-session');

var passport = require('passport');

var orm = require("orm");
var database = require("./app/database");

var schedule = require('node-schedule');

var fx = require("money");

var jwt = require("jwt-simple");

// create and configure server =================================================
var server = express();

// morgan logger in dev format
server.use(morgan({ format: 'dev', immediate: true }));

// database connection
server.use(orm.express("pg://abhihnahgxvxim:WTaDQYg7roQaOx0ieKNDoKZ-V-@ec2-54-197-238-242.compute-1.amazonaws.com:5432/d4ielacnr2v55l?ssl=true&pool=true", {
    define: database
}));

// Add headers in order to circumvent the javascript same origin policy (to be removed in production)
server.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.header('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.header('Access-Control-Allow-Headers', 'X-Requested-With, content-type, x-access-token');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.header('Access-Control-Allow-Credentials', true);
    
    if (req.method === 'OPTIONS') {
        // Bypass browser's CORS options requests
        res.send(200);
    } else {
        // Pass to next layer of middleware
        next();
    }
});

// if possible compress with gzip
server.use(compress());

// read cookies (needed for auth)
server.use(cookieParser());

// parse the HTTP entity body, data available in res.body
server.use(bodyParser({
    maxBodySize: 65535,
    mapParams: false
}));

// static
server.use(express.static(__dirname + '/../MobileClient/www'));

// session secret
server.use(session({ secret: 'ilovekittiessomuch' }));

// pass passport for configuration
require('./config/passport')(passport);

// setup passport
server.use(passport.initialize());

// persistent login sessions
server.use(passport.session());

// routes ==========================================

require('./config/scheduler')(schedule, fx);

require('./config/jwtAuth.js')(server);

// load our routes and pass in our server and fully configured passport
require('./app/routes.js')(server, passport, fx, jwt);

// launch ==========================================
var port = process.env.PORT || 1337;

server.listen(port, function () {
    console.log('listening at %s', port);
});
