angular.module('starter.controllers', [])

    .controller('AppCtrl', function ($scope, $state, $ionicSideMenuDelegate, $cookieStore, AuthService, Restangular) {

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
            Restangular.all('events').one(AuthService.event()).all('leave').post({
            }).then(function (data) {
                AuthService.setAdmin(false);
                $state.go('welcome');
            },
            function (response) {
                AuthService.setAdmin(false);
                $state.go('welcome');
            });
        };

        $scope.isAdmin = AuthService.isAdmin();
        $scope.$watch(AuthService.isAdmin, function (isAdmin) {
            $scope.isAdmin = isAdmin;
        });
    })

    .controller('LoginCtrl', function ($scope, $state, $ionicLoading, Restangular, AuthService, AlertPopupService) {

        $scope.facebookLogin = function () {
            OAuth.popup("facebook", {authorize:{scope:"public_profile user_friends email"}}, function (err, res) {
                if (err) {
                    AlertPopupService.createPopup("Error", err);
                } else {
                    $ionicLoading.show({
                        template: 'Logging in...'
                    });
                    Restangular.all('login').all('facebook').post({
                        token: res.access_token
                    }).then(function (data) {
                        AuthService.login(data.user, data.access_token);
                        $ionicLoading.hide();
                        console.log(data.user);

                        if (data.user && data.user.CurrentEvent) {
                            AuthService.setEvent(data.user.CurrentEvent);
                            $state.go('app.map', {userId: data.user.id});
                        } else {
                            AuthService.setEvent('');
                            $state.go('welcome', {userId: data.user.id});
                        }
                    },
                    function (response) {
                        $ionicLoading.hide();
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

    .controller('WelcomeCtrl', function ($scope, $state, $stateParams, $ionicLoading, AlertPopupService, Restangular, AuthService) {
        $scope.data = {
            groupName: '',
            groupPass: ''
        };

        $scope.createGroup = function () {
            console.log("Create", $scope.data.groupName, $scope.data.groupPass);

            $ionicLoading.show({
                template: 'Creating event...'
            });
            Restangular.all('events').post({
                name: $scope.data.groupName,
                password: $scope.data.groupPass
            }).then(function (data) {
                $ionicLoading.hide();
                console.log(data);
                AuthService.setAdmin(true);
                AuthService.setEvent(data.Name);
                $state.go('app.map', { userId: 1 });
            }, function (err) {
                $ionicLoading.hide();

                if (err.data && err.data.error) {
                    AlertPopupService.createPopup("Error", err.data.error);
                } else {
                    AlertPopupService.createPopup("Error", JSON.stringify(err));
                }
            });
        };

        $scope.joinGroup = function () {
            console.log("Join", $scope.data.groupName, $scope.data.groupPass);

            $ionicLoading.show({
                template: 'Joining event...'
            });
            Restangular.all('events').one($scope.data.groupName).all('join').post({
                password: $scope.data.groupPass
            }).then(function (data) {
                $ionicLoading.hide();
                console.log(data);
                AuthService.setAdmin(true);
                AuthService.setEvent($scope.data.groupName);
                $state.go('app.map', { userId: 1 });
            }, function (err) {
                $ionicLoading.hide();
                AlertPopupService.createPopup("Error", JSON.stringify(err));
            });
        };
    })

    .controller('ConfigCtrl', function ($scope, $state, $stateParams, Restangular) {
        $scope.users = [
            {
                name: 'Duarte',
                email: 'duarte@example.com',
                avatar: 'img/ionic.png'
            }, {
                name: 'JPDias',
                email: 'pinto@example.com',
                avatar: 'img/ionic.png'
            }, {
                name: 'Pinto',
                email: 'jpdias@example.com',
                avatar: 'img/ionic.png'
            }, {
                name: 'Pedro',
                email: 'pedro@example.com',
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

    .controller('MapCtrl', function ($scope, $ionicLoading, $ionicPopup, AlertPopupService, $ionicSideMenuDelegate, AuthService, Restangular, $timeout) {

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
            navigator.geolocation.getCurrentPosition(function (pos) {
                Restangular.one('pois').get({"lat":  pos.coords.longitude, "long": pos.coords.latitude, "cat": 111, "range": 4}).then(function (data) {
                    console.log("pois request", data);
                  for (var i = 0; i < data.length; i++) {
                      addMarker(data[i].geom_feature.coordinates[1], data[i].geom_feature.coordinates[0], map, "http://www.ourtownstories.co.uk/images/pin-map.png", data[i].name, true);
                  }
                }, function (err) {
                    console.log("pois request err", err);
                });
            });

            var markers = [];

            (function markersTick() {
                Restangular.all('events').one(AuthService.event()).all('users').getList().
                    then(function (users) {
                        for (var i = 0; i < markers.length; i++) {
                            markers[i].setMap(null);
                        }

                        markers = [];

                        for (i = 0; i < users.length; i++) {
                            addMarker(users[i].Position.Lat, users[i].Position.Long, map, "http://ruralshores.com/assets/marker-icon.png", users[i].Name);
                        }
                    }, function (err) {
                        console.log(err);
                    });

                $timeout(markersTick, 5000);
            })();

            function addMarker(lat, long, map, icon, description, permanent) {
                var marker = new google.maps.Marker({
                    position: new google.maps.LatLng(lat, long),
                    map: map,
                    icon: icon
                });

                if (!permanent)
                    markers.push(marker);

                google.maps.event.addListener(marker, 'click', (function(marker) {
                    return function() {
                        infowindow.setContent(description);
                        infowindow.open(map, marker);
                    }
                })(marker));
            }

            var myPosition = { Lat: 0, Long: 0 };

            (function updatePosTick() {
                navigator.geolocation.getCurrentPosition(function (pos) {
                    myPosition.Lat = pos.coords.latitude;
                    myPosition.Long = pos.coords.longitude;

                    Restangular.all('users').one(AuthService.currentUser().Email).all('location').post({
                        lat: pos.coords.latitude,
                        long: pos.coords.longitude
                    }).then(function (response) {
                        console.log("updatePosTick request", response);
                    }, function (err) {
                        console.log("updatePosTick request error", err);
                    });

                }, function (error) {
                    console.log("updatePosTick error", error);
                });

                $timeout(updatePosTick, 5000);
            })();

            (function getNotificationsTick() {
                Restangular.all('user').one(AuthService.currentUser().Email).all('notifications').getList()
                    .then(function(notifications) {
                        console.log("Notifications request", notifications);
                        if (notifications.length == 0) {
                            return;
                        }

                        var notif = notifications[notifications.length - 1];
                        var alertPopup = $ionicPopup.alert({
                            title: 'Notification',
                            template: notif.Text
                        });

                        alertPopup.then(function () {
                            addMarker(notif.Position.Lat, notif.Position.Long, map, "http://portal.roadworks.org/img/portal/fr/marker_road_cone2.png", notif.Text, true);
                            mapRoute(myPosition, notif.Position);
                        });

                    }, function (err) {
                        console.log("Notifications request error", err);
                    });

                $timeout(getNotificationsTick, 5000);
            })();

            function mapRoute(ori, dest) {

                var start = new google.maps.LatLng(ori.Lat, ori.Long);
                var end = new google.maps.LatLng(dest.Lat, dest.Long);
                var request = {
                    origin: start,
                    destination: end,
                    travelMode: google.maps.TravelMode.WALKING
                };
                directionsService.route(request, function(result, status) {
                    if (status == google.maps.DirectionsStatus.OK) {
                        directionsDisplay.setDirections(result);
                    } else {
                        console.log("couldn't get directions", status);
                    }
                });
            }

            var mapOptions = {
                center: new google.maps.LatLng(41.17,-8.614912),
                zoom: 16,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            };
            var map = new google.maps.Map(document.getElementById("map"),
                mapOptions);
            map.set('styles', [
                {
                    "stylers": [
                        {
                            "hue": "#007fff"
                        },
                        {
                            "saturation": 89
                        }
                    ]
                },
                {
                    "featureType": "water",
                    "stylers": [
                        {
                            "color": "#ffffff"
                        }
                    ]
                },
                {
                    "featureType": "administrative.country",
                    "elementType": "labels",
                    "stylers": [
                        {
                            "visibility": "off"
                        }
                    ]
                }
            ]);   
            var infowindow = new google.maps.InfoWindow();
            var directionsService = new google.maps.DirectionsService();
            var directionsDisplay = new google.maps.DirectionsRenderer({
                polylineOptions: {
                  strokeColor: "red"
                }
              });
            directionsDisplay.setMap(map);

            // Stop the side bar from dragging when mousedown/tapdown on the map
            google.maps.event.addDomListener(document.getElementById('map'), 'mousedown', function (e) {
                e.preventDefault();
                return false;
            });

            google.maps.event.addListener(map, 'click', function(event) {
                var confirmPopup = $ionicPopup.confirm({
                    title: 'Meet Point'
                });
                confirmPopup.then(function (res) {
                    if (res) {
                        var lat = event.latLng.lat();
                        var long = event.latLng.lng();
                        Restangular.all('events').one(AuthService.event()).all('notification').post({
                            text: 'You have been summoned',
                            lat: lat,
                            long: long
                        }).then(function (data) {
                            console.log('Send Notification request', data);
                        }, function (err) {
                            console.log('Send Notification error', err);
                        });
                    } else {
                    }
                });
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
                $ionicLoading.hide();
            }, function (error) {
                $ionicLoading.hide();
                AlertPopupService.createPopup("Error", "Unable to get location" + error.message);
            });
        };

        initialize();
    });
