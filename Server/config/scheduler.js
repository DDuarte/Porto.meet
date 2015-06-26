// config/scheduler.js

var async = require("async");
var request = require("request");
var Datastore = require('nedb');

module.exports = function (scheduler, fx) {

    var dbPath = "./config/currency.db";
    var db;

    // currency rates as of 2014-05-09
    var defaultFx = {

        type: "rates",
        date: "2014-05-09",
        base: "EUR",
        rates: {
            "AUD": 1.4714,
            "BGN": 1.9558,
            "BRL": 3.0506,
            "CAD": 1.4925,
            "CHF": 1.2186,
            "CNY": 8.5821,
            "CZK": 27.392,
            "DKK": 7.464,
            "GBP": 0.8173,
            "HKD": 10.683,
            "HRK": 7.5863,
            "HUF": 303.98,
            "IDR": 15841.14,
            "ILS": 4.7598,
            "INR": 82.721,
            "JPY": 140.14,
            "KRW": 1413.41,
            "LTL": 3.4528,
            "MXN": 17.865,
            "MYR": 4.4492,
            "NOK": 8.137,
            "NZD": 1.5957,
            "PHP": 60.161,
            "PLN": 4.1823,
            "RON": 4.4298,
            "RUB": 48.527,
            "SEK": 9.0189,
            "SGD": 1.7215,
            "THB": 44.934,
            "TRY": 2.8662,
            "USD": 1.3781,
            "ZAR": 14.278
        }

    };

    async.series([
            function(callback) {
                db = new Datastore({ filename: dbPath, autoload: true });

                // get the most recent ratingsDocument in the db
                db.findOne({ type: "rates" }).sort({ date: -1 }).exec(function (err, ratingsDocument) {

                    if (err)
                        return callback(err);

                    if (ratingsDocument) {
                        fx.rates = ratingsDocument.rates;
                        fx.base = ratingsDocument.base;
                    } else {
                        fx.rates = defaultFx.rates;
                        fx.base = defaultFx.base;
                        db.insert(defaultFx);
                    }

                    callback(null);
                });
            },
            function(callback) {

                request.get("http://api.fixer.io/latest", function (err, response, body) {

                    if (err)
                        return callback(err);

                    if (response.statusCode !== 200)
                        return callback({ error: "Fixer.io api GET request returned: " + response.statusCode });

                    body = JSON.parse(body); // parse the response

                    fx.rates = body.rates;
                    fx.base = body.base;
                    fx.settings.from = fx.base;

                    callback(null, fx);
                });
            }
        ],
        function(err) {

            if (err)
                console.log(err);
        });

    // schedule conversion rates update (everyday at 5 AM)
    var currencyUpdateJob = scheduler.scheduleJob({ hour: 5, minute: 0 }, function(){
        request.get("http://api.fixer.io/latest", function (err, response, body) {

            if (err)
                return console.log(err);

            if (response.statusCode !== 200)
                return console.log({ error: "Fixer.io api GET request returned: " + response.statusCode });

            var currencies = JSON.parse(body); // parse the response

            fx.rates = currencies.rates;
            fx.base = currencies.base;
            fx.settings.from = fx.base;

            currencies.type = "rates";

            db.update({ type: "rates" }, currencies, {});
        });
    });
};