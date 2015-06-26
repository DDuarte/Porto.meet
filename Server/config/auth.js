// config/auth.

var port = process.env.PORT || 1337;
var url = process.env.URL || "http://localhost:" + port + "/";

module.exports = {

    facebookAuth: {
        clientID: process.env.FB_CLIENT_ID || "279961542177568",
        clientSecret: process.env.FB_CLIENT_SECRET || "72f23d486592a7af12a79c0020457a54",
        signupCallbackURL: url + "signup/facebook/callback",
        loginCallbackURL: url + "login/facebook/callback",
        connectCallbackURL: url + "connect/facebook/callback"
    },

    googleAuth: {
        clientID: "20245249929-c4vg5b8ejg10156llvdgiccr1lc6evtp.apps.googleusercontent.com",
        clientSecret: "THEioXacp0YhbX07ci37aFM2",
        signupCallbackURL: url + "signup/google/callback",
        loginCallbackURL: url + "login/google/callback",
        connectCallbackURL: url + "connect/google/callback",
        realm: url
    }
};
