var orm = require('orm');

module.exports = function (db, models) {

    var user = db.define("user", {
        id: { type: "text", required: true },
        email: { type: "text", size: 254, required: false, unique: true },
        avatar: { type: "text", required: false, defaultValue: '' }
    }, {
        validations: {
            passwordHash: orm.enforce.ranges.length(64, 64, "invalid-password-length"),
            email: orm.enforce.patterns.email("invalid-email-format")
        }
    });

    var facebook = db.define("facebook", {
        id: { type: "text", required: true },
        token: { type: "text", required: true, unique: true },
        email: { type: "text", size: 254, required: true, unique: true },
        displayName: { type: "text", required: true },
        avatar: { type: "text", required: false, defaultValue: '' }
    }, {
        validations: {
            email: orm.enforce.patterns.email("invalid-email-format")
        }
    });

    user.hasOne("facebookAccount", facebook);
    facebook.hasOne("localAccount", user, { required: true }); // every facebook account has to be linked to a local account

    var google = db.define("google", {
        id: { type: "text", required: true },
        token: { type: "text", unique: true },
        email: { type: "text", size: 254, required: true, unique: true },
        displayName: { type: "text", required: true },
        avatar: { type: "text", required: false, defaultValue: '' }
    }, {
        validations: {
            email: orm.enforce.patterns.email("invalid-email-format")
        }
    });

    user.hasOne("googleAccount", google);
    google.hasOne("localAccount", user, { required: true }); // every google account has to be linked to a local account

    models.user = user;
    models.facebook = facebook;
    models.google = google;

    db.sync(function (err) {
        if (err)
            console.log("Error when syncing db: %s", err);
    });
}
