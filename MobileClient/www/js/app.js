// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('PortoMeetApp', ['ionic', 'starter.controllers', 'restangular', 'ngCookies'])

    .run(function ($ionicPlatform, $cookieStore, AuthService) {
        $ionicPlatform.ready(function () {
            // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
            // for form inputs)
            if (window.cordova && window.cordova.plugins.Keyboard) {
                cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
            }
            if (window.StatusBar) {
                // org.apache.cordova.statusbar required
                StatusBar.styleDefault();
            }
        });
    })

    .service('AlertPopupService', ['$ionicPopup', function ($ionicPopup) {

        this.createPopup = function (headerMessage, bodyMessage, okAction) {
            $ionicPopup.alert({
                title: headerMessage,
                content: bodyMessage
            }).then(function (res) {
                if (okAction)
                    okAction();
            });
        }
    }])

    .factory('DateFormatter', function () {
        var root = {};

        root.formatDate = function (arg) { // converting hours minutes and seconds does not work
            now = new Date(arg);
            year = "" + now.getFullYear();
            month = "" + (now.getMonth() + 1);
            if (month.length == 1) {
                month = "0" + month;
            }
            day = "" + now.getDate();
            if (day.length == 1) {
                day = "0" + day;
            }
            /*
             hour = "" + now.getHours(); if (hour.length == 1) { hour = "0" + hour; }
             minute = "" + now.getMinutes(); if (minute.length == 1) { minute = "0" + minute; }
             second = "" + now.getSeconds(); if (second.length == 1) { second = "0" + second; }
             */
            return day + "-" + month + "-" + year;
        }


        return root;
    })

    // singleton, this service can be injected into any route in order to check the current user session information
    .provider('AuthService', function AuthServiceProvider() {

        var currentUser;

        function token() {
            if (currentUser && currentUser.access_token)
                return currentUser.access_token;
            else
                return null;
        }

        this.token = token;

        function CurrentUser($cookieStore) {

            this.storage = $cookieStore;

            this.login = function (user, access_token) {
                if (user && access_token) {
                    currentUser = user;
                    currentUser.access_token = access_token;
                    this.storage.put('user', user);
                    this.storage.put('token', access_token);
                }
            };

            this.logout = function () {
                this.storage.remove('user');
                this.storage.remove('token');
                currentUser = null;
            };

            this.isLoggedIn = function () {
                return currentUser != null;
            };

            this.currentUser = function () {
                return currentUser;
            };

            this.token = token;
        }

        this.$get = ['$cookieStore', function ($cookieStore) {
            return new CurrentUser($cookieStore);
        }];
    })

    .config(function ($stateProvider, $urlRouterProvider, RestangularProvider, AuthServiceProvider) {

        // base API Url
        //RestangularProvider.setBaseUrl('https://payback-app.herokuapp.com/api');
        RestangularProvider.setBaseUrl('http://localhost:1337/api');

        RestangularProvider.addFullRequestInterceptor(function (element, operation, what, url, headers) {
            return {
                headers: _.extend(headers, {'x-access-token': AuthServiceProvider.token()})
            }
        });

        RestangularProvider.setDefaultHttpFields({timeout: 10000}); // set timeout of 10 seconds

        OAuth.initialize('b-iBME2kgUSSguGOubYOIxe6pqQ');

        // configure states
        $stateProvider

            .state('login', {
                url: '/login',
                templateUrl: 'templates/login.html',
                controller: 'LoginCtrl'
            })

            .state('app', {
                url: '/app',
                abstract: true,
                templateUrl: 'templates/menu.html',
                controller: 'AppCtrl'
            })

			.state('app.welcome', {
				url: '/welcome',
                views: {
                    'app': {
                        templateUrl: 'templates/welcome.html',
                        controller: 'WelcomeCtrl'
                    }
                }
			})

            .state('app.user', {
                url: '/users/:userId',
                views: {
                    'app': {
                        templateUrl: 'templates/user.html',
                        controller: 'UserCtrl'
                    }
                }
            })

            .state('app.map', {
                url: '/map',
                views: {
                    'app': {
                        templateUrl: 'templates/map.html',
                        controller: 'MapCtrl'
                    }
                }
            });

        // if none of the above states are matched, use this as the fallback
        $urlRouterProvider.otherwise('/login');
    });
