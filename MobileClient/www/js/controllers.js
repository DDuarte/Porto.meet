angular.module('starter.controllers', [])

    .controller('AppCtrl', function ($scope, $state, $ionicSideMenuDelegate, $cookieStore, AuthService) {

        $scope.toggleLeft = function () {
            $ionicSideMenuDelegate.toggleLeft();
        };

        var user = $cookieStore.get('user');
        var access_token = $cookieStore.get('token');
        AuthService.login(user, access_token, $cookieStore);

        // watch for any changes in the loggedIn status
        $scope.$watch(AuthService.isLoggedIn, function (isLoggedIn) {
            $scope.isLoggedIn = isLoggedIn;
            $scope.currentUser = AuthService.currentUser();

            if (!$scope.isLoggedIn) {
                $state.go('login');
            }
        });

        $scope.logout = function () {
            AuthService.logout();
            $state.go('login');
        };

        $scope.abandon = function () {
            // TODO: request abandon group
            AuthService.setAdmin(false);
            $state.go('welcome');
        };

        $scope.isAdmin = AuthService.isAdmin();
        $scope.$watch(AuthService.isAdmin, function (isAdmin) {
            $scope.isAdmin = isAdmin;
        });
    })
    .controller("NotifyCtrl", function($scope, $cordovaLocalNotification, $timeout) {
 
        $scope.add = function() {
            var alarmTime = new Date();
            alarmTime.setMinutes(alarmTime.getMinutes() + 1);
            $cordovaLocalNotification.add({
                id: "1234",
                date: alarmTime,
                message: "This is a message",
                title: "This is a title",
                autoCancel: true,
                sound: null
            }).then(function () {
                console.log("The notification has been set");
            });
        };
     
        $scope.isScheduled = function() {
            $cordovaLocalNotification.isScheduled("1234").then(function(isScheduled) {
                alert("Notification 1234 Scheduled: " + isScheduled);
            });
        };
        
        var poll = function() {
             $timeout(function() {
                 //update your chart
                 $scope.param1 = $scope.param2;
                 $scope.param2++ ;
                 poll();
             }, 100*$scope.pollingperiod);
         };     
         poll();
    })

    .controller('LoginCtrl', function ($scope, $state, $ionicLoading, Restangular, AuthService, AlertPopupService) {

        $scope.localLogin = function (user) {
            $ionicLoading.show({
                template: 'Logging in...'
            });
            Restangular.all('login').all('local').post({
                id: user.id,
                password: CryptoJS.SHA256(user.password).toString(CryptoJS.enc.Hex)
            }).then(function (data) {
                AuthService.login(data.user, data.access_token);
                $ionicLoading.hide();
                $state.go('welcome', { userId: data.user.id });
            }, function (response) {
                $ionicLoading.hide();
                AlertPopupService.createPopup("Error", response.data.error);
            });
        };

        $scope.facebookLogin = function () {
            OAuth.popup("facebook", {authorize:{scope:"public_profile user_friends email"}}, function (err, res) {
                if (err) {
                    AlertPopupService.createPopup("Error", err);
                }
                else {

                    $ionicLoading.show({
                        template: 'Logging in...'
                    });
                    Restangular.all('login').all('facebook').post({
                        token: res.access_token
                    }).then(function (data) {
                            AuthService.login(data.user, data.access_token);
                            $ionicLoading.hide();
                            $state.go('welcome', { userId: data.user.id});
                        },
                        function (response) {
                            $ionicLoading.hide();

                            if (response.data.error == "User not found") {
                                Restangular.all('signup').all('facebook').post({
                                    token: res.access_token
                                }).then(function (data) {
                                    AuthService.login(data.user, data.access_token);
                                    $ionicLoading.hide();
                                    $state.go('welcome', { userId: data.user.id });
                                }, function (response) {
                                    $ionicLoading.hide();
                                    AlertPopupService.createPopup("Error", response.data.error);
                                });
                            } else
                                AlertPopupService.createPopup("Error", response.data.error);
                        });
                }
            });
        };

        $scope.googleLogin = function () {
            OAuth.popup("google_plus", {authorize:{scope:"profile https://www.googleapis.com/auth/plus.login https://www.googleapis.com/auth/userinfo.profile email"}}, function (err, res) {
                if (err) {
                    AlertPopupService.createPopup("Error", err);
                }
                else {
                    $ionicLoading.show({
                        template: 'Logging in...'
                    });
                    Restangular.all('login').all('google').post({
                        token: res.access_token
                    }).then(function (data) {
                            AuthService.login(data.user, data.access_token);
                            $ionicLoading.hide();
                            $state.go('welcome', { userId: data.user.id});
                        },
                        function (response) {
                            $ionicLoading.hide();

                            if (response.data.error == "User not found") {
                                Restangular.all('signup').all('google').post({
                                    token: res.access_token
                                }).then(function (data) {
                                    AuthService.login(data.user, data.access_token);
                                    $ionicLoading.hide();
                                    $state.go('welcome', { userId: data.user.id });
                                }, function (response) {
                                    $ionicLoading.hide();
                                    AlertPopupService.createPopup("Error", response.data.error);
                                });
                            } else
                                AlertPopupService.createPopup("Error", response.data.error);
                        });
                }
            });
        };
    })

    .controller('UserCtrl', function ($scope, $state, $stateParams, Restangular, AuthService, DateFormatter, AlertPopupService) {
        $scope.dateFormatter = DateFormatter;
        $scope.isEditing = false;

        Restangular.one('users', $stateParams.userId).get().then(function (data) {
            $scope.user = data;

        }).then(function () {

            Restangular.one('users', $stateParams.userId).then(function (data) {
                $scope.currentUser = AuthService.currentUser();
            });
        });

        $scope.cancelEdit = function () {
            $scope.isEditing = false;
        }
    })

    .controller('WelcomeCtrl', function ($scope, $state, $stateParams, Restangular, AuthService) {
        $scope.data = {
            groupName: '',
            groupPass: ''
        };

        $scope.createGroup = function () {
            console.log("Create", $scope.data.groupName, $scope.data.groupPass);

            AuthService.setAdmin(true);
            $state.go('app.map', { userId: 1 });
        };

        $scope.joinGroup = function () {
            console.log("Join", $scope.data.groupName, $scope.data.groupPass);
            $state.go('app.map', { userId: 1 });
        };
    })

    .controller('ConfigCtrl', function ($scope, $state, $stateParams, Restangular) {
        $scope.users = [
            {
                name: 'Joaquina',
                email: 'joaquina@example.com',
                avatar: 'img/ionic.png'
            }, {
                name: 'Jo�o',
                email: 'joao@example.com',
                avatar: 'img/ionic.png'
            }, {
                name: 'Joana',
                email: 'joana@example.com',
                avatar: 'img/ionic.png'
            }
        ];

        $scope.kickUser = function (idx) {
            // TODO: request kick
            if (idx > -1) {
                $scope.users.splice(idx, 1);
            }
        };

        $scope.deleteGroup = function () {
            // TODO: request delete
        };

        $scope.visibilityChange = function () {
            // TODO: request visibility change: $scope.publicVisibility
        };
    })

    .controller('MapCtrl', function ($scope, $ionicLoading, AlertPopupService, $ionicSideMenuDelegate) {

        $scope.map = {
            center: {
                latitude: 45,
                longitude: -73
            },
            zoom: 16,
            bounds: {},
            draggable: "true"
            //maps.MapTypeId.ROADMAP
        };

        function initialize() {
            
            var pois =  [
              ['Book', -8.614912, 41.14679, 1],
              ['UP', -8.6155879497528, 41.147076493095, 2],
            ];
            
            var users = [
              ['A', -8.614, 41.14679, 1],
              ['B', -8.616, 41.147076493095, 2],
            ];
            
            var mapOptions = {
                center: new google.maps.LatLng(-8.614912,41.14679),
                zoom: 16,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            };
            var map = new google.maps.Map(document.getElementById("map"),
                mapOptions);

            var infowindow = new google.maps.InfoWindow();

            var marker, i;
        
            for (i = 0; i < pois.length; i++) {  
              marker = new google.maps.Marker({
                position: new google.maps.LatLng(pois[i][2], pois[i][1]),
                map: map
              });
        
              google.maps.event.addListener(marker, 'click', (function(marker, i) {
                return function() {
                  infowindow.setContent(pois[i][0]);
                  infowindow.open(map, marker);
                }
              })(marker, i));
            }
            
            for (i = 0; i < users.length; i++) {  
              marker = new google.maps.Marker({
                position: new google.maps.LatLng(users[i][2], users[i][1]),
                map: map,
                icon: "http://ruralshores.com/assets/marker-icon.png"
              });
        
              google.maps.event.addListener(marker, 'click', (function(marker, i) {
                return function() {
                  infowindow.setContent(users[i][0]);
                  infowindow.open(map, marker);
                }
              })(marker, i));
            }
            // Stop the side bar from dragging when mousedown/tapdown on the map
            google.maps.event.addDomListener(document.getElementById('map'), 'mousedown', function (e) {
                e.preventDefault();
                return false;
            });

            $scope.map = map;

            $ionicSideMenuDelegate.canDragContent(false);
        }

        $scope.centerOnMe = function () {
            if (!$scope.map) {
                return;
            }

            $scope.loading = $ionicLoading.show({
                content: 'Getting current location...',
                showBackdrop: false
            });

            navigator.geolocation.getCurrentPosition(function (pos) {
                var marker = new google.maps.Marker({
                    position: new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude),
                    map: $scope.map
                });

                $scope.map.setCenter(new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude));
                //$scope.loading.hide();
                $ionicLoading.hide();
            }, function (error) {
                $ionicLoading.hide();
                AlertPopupService.createPopup("Error", "Unable to get location" + error.message);
            });
        };

        initialize();
    })
