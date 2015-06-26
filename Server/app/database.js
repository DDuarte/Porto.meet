var orm = require('orm');

module.exports = function (db, models) {
    var validCurrencies = [
        "AUD", "BGN", "BRL", "CAD",
        "CHF", "CNY", "CZK", "DKK",
        "EUR", "GBP", "HKD", "HRK",
        "HUF", "IDR", "ILS", "INR",
        "JPY", "KRW", "LTL", "MXN",
        "MYR", "NOK", "NZD", "PHP",
        "PLN", "RON", "RUB", "SEK",
        "SGD", "THB", "TRY", "USD",
        "ZAR"
    ];

    var user = db.define("user", {
        id: { type: "text", required: true },
        passwordHash: { type: "text", size: 64 },
        email: { type: "text", size: 254, required: false, unique: true },
        currency: { type: "text", required: false, defaultValue: 'EUR' },
        avatar: { type: "text", required: false, defaultValue: '' }
    }, {
        validations: {
            passwordHash: orm.enforce.ranges.length(64, 64, "invalid-password-length"),
            email: orm.enforce.patterns.email("invalid-email-format"),
            currency: orm.enforce.lists.inside(validCurrencies, "invalid-currency")
        }
    });

    user.hasMany('friends', user, { date: Date });

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

    var debt = db.define("debt", {
        description: {type: "text", required: false, defaultValue: ""},
        created: { type: "date"  },
        modified: { type: "date"  },
        originalValue: { type: "number", rational: true, required: true  },
        value: { type: "number", rational: true, required: true  },
        currency: { type: "text", required: true }
    }, {
        hooks: {
            beforeCreate: function (next) {
                this.created = new Date();
                next();
            },
            beforeSave: function (next) {
                this.modified = new Date();
                next();
            }
        },
        validations: {
            value: orm.enforce.ranges.number(0, undefined, "negative-value"),
            currency: orm.enforce.lists.inside(validCurrencies, "invalid-currency")
        }
    });

    debt.hasOne("creditor", user, { reverse: "credits", required: true });
    debt.hasOne("debtor", user, { reverse: "debts", required: true });

    models.user = user;
    models.debt = debt;
    models.facebook = facebook;
    models.google = google;

    db.sync(function (err) {
        if (err)
            console.log("Error when syncing db: %s", err);
    });
}
