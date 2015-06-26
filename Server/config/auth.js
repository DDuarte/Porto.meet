// config/auth.

var port = process.env.PORT || 1337;
var url = process.env.URL || "http://localhost:" + port + "/";

module.exports = {

    facebookAuth: {
        clientID: process.env.FB_CLIENT_ID || "428106830694430",
        clientSecret: process.env.FB_CLIENT_SECRET || "9cc43a5440b170159c0063eb989e884c",
        signupCallbackURL: url + "signup/facebook/callback",
        loginCallbackURL: url + "login/facebook/callback",
        connectCallbackURL: url + "connect/facebook/callback"
    },

    googleAuth: {
        clientID: "26482293137-e5cubq9u9g8vgp3socahm6be6sr9kql7.apps.googleusercontent.com",
        clientSecret: "2ITt9SQAodPTxO9zNLBElmEL",
        signupCallbackURL: url + "signup/google/callback",
        loginCallbackURL: url + "login/google/callback",
        connectCallbackURL: url + "connect/google/callback",
        realm: url
    }
};
