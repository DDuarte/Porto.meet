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
        }
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
                $state.go('app.debts', { userId: data.user.id, initFilter: "", openDebt: -1 });
            }, function (response) {
                $ionicLoading.hide();
                AlertPopupService.createPopup("Error", response.data.error);
            });
        };

        $scope.facebookLogin = function () {
            OAuth.popup("facebook", function (err, res) {
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
                            $state.go('app.debts', { userId: data.user.id});
                        },
                        function (response) {
                            $ionicLoading.hide();
                            AlertPopupService.createPopup("Error", response.data.error);
                        });
                }
            });
        };

        $scope.googleLogin = function () {
            OAuth.popup("google_plus", function (err, res) {
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
                            $state.go('app.debts', { userId: data.user.id});
                        },
                        function (response) {
                            $ionicLoading.hide();
                            AlertPopupService.createPopup("Error", response.data.error);
                        });
                }
            });
        };
    })

    .controller('SignupCtrl', function ($scope, $state, $ionicLoading, Restangular, AuthService, AlertPopupService) {

        $scope.currencies = [
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

        $scope.currency = $scope.currencies[$scope.currencies.indexOf("EUR")];

        $scope.signup = function (user) {
            $ionicLoading.show({
                template: 'Signing up new account...'
            });

            Restangular.all('signup').all('local').post({
                id: user.id,
                password: CryptoJS.SHA256(user.password).toString(CryptoJS.enc.Hex),
                email: user.email,
                currency: $scope.currency
            }).then(function (data) {
                AuthService.login(data.user, data.access_token);

                $ionicLoading.hide();
                $state.go('app.debts', { userId: data.user.id});
            }, function (response) {
                $ionicLoading.hide();
                AlertPopupService.createPopup("Error", response.data.error);
            });
        };

        $scope.facebookSignup = function () {

            OAuth.popup("facebook", function (err, res) {
                if (err) {
                    AlertPopupService.createPopup("Error", err);
                }
                else {
                    $ionicLoading.show({
                        template: 'Signing up new account...'
                    });

                    Restangular.all('signup').all('facebook').post({
                        token: res.access_token
                    }).then(function (data) {
                        AuthService.login(data.user, data.access_token);
                        $ionicLoading.hide();
                        $state.go('app.debts', { userId: data.user.id });
                    }, function (response) {
                        $ionicLoading.hide();
                        AlertPopupService.createPopup("Error", response.data.error);
                    });
                }
            });
        };

        $scope.googleSignup = function () {

            OAuth.popup("google_plus", function (err, res) {
                if (err) {
                    AlertPopupService.createPopup("Error", err);
                }
                else {
                    $ionicLoading.show({
                        template: 'Signing up new account...'
                    });

                    Restangular.all('signup').all('google').post({
                        token: res.access_token
                    }).then(function (data) {
                        AuthService.login(data.user, data.access_token);
                        $ionicLoading.hide();
                        $state.go('app.debts', { userId: data.user.id });
                    }, function (response) {
                        $ionicLoading.hide();
                        AlertPopupService.createPopup("Error", response.data.error);
                    });
                }
            });
        }
    })

    .controller('UserCtrl', function ($scope, $state, $stateParams, Restangular, AuthService, DateFormatter) {
        $scope.dateFormatter = DateFormatter;
        $scope.loadingDebts = true;

        $scope.countActive = function() {
            if ($scope.loadingDebts ) return 0;
            else  {
                var count = 0;
               $scope.debts.debts.forEach(function (debt) {
                   if (debt.value > 0) count++;
               });
                   return count;

            }

        }

        Restangular.one('users', $stateParams.userId).get().then(function (data) {
            $scope.user = data;

        }).then(function () {

            Restangular.one('users', $stateParams.userId).one('debts').get().then(function (data) {
                $scope.currentUser = AuthService.currentUser();
                $scope.debts = data;
                $scope.loadingDebts = false;

            });

        });

        $scope.openDebt = function(debtId) {

            $state.go('app.debts', { userId: $scope.currentUser.id, openDebt: debtId, initFilter: ""});
        }


    })

    .filter('matchTab', function(AuthService) {
        return function(  items ,searchText,filter, userId) {
            var search = searchText.toLowerCase();
            var filtered = [];
            angular.forEach(items, function(item) {
                if (AuthService.currentUser() && item.value != 0 && (item.debtor ==  AuthService.currentUser().id || item.creditor == AuthService.currentUser().id)) {
                    if (filter == 'owed' && item.debtor == userId && item.debtor.toLowerCase().indexOf(search) > -1)
                        filtered.push(item);
                    else if (filter == 'own' && item.debtor != userId && item.debtor.toLowerCase().indexOf(search) > -1)
                        filtered.push(item);
                    else if (filter == 'all'&& (item.debtor.indexOf(search) > -1|| item.debtor.toLowerCase().indexOf(search) > -1) )
                        filtered.push(item);
                }

            });
            return filtered;
        };
    })

    .filter('history', function(AuthService) {
        return function( items, searchText ) {
            var filtered = [];
            angular.forEach(items, function(item) {
                if (item.value == 0 && (item.debtor.indexOf(searchText.toLowerCase()) > -1|| item.debtor.toLowerCase().indexOf(searchText.toLowerCase()) > -1)  && (item.debtor ==  AuthService.currentUser().id || item.creditor == AuthService.currentUser().id)) {
                        filtered.push(item);
                }

            });

            return filtered;
        };
    })

    .controller('DebtsCtrl', function ($scope,$state, $stateParams, $ionicModal, $ionicPopup, Restangular, AuthService, AlertPopupService, DateFormatter) {

        $scope.filter = 'all';

        $scope.openDebt = $stateParams.openDebt;

        $scope.countActive = function() {
            if ($scope.loading ) return 0;
            else  {
                var count = 0;
                $scope.debts.debts.forEach(function (debt) {
                    if (debt.value > 0) count++;
                });
                return count;

            }

        }


        if ($stateParams.initFilter) {
            if ($stateParams.initFilter != "")$scope.filter = $stateParams.initFilter;
        }

        $scope.dateFormatter = DateFormatter;

        $scope.loading = true;

        $scope.searchText = '';

        $scope.setFilter = function(filter) {
            $scope.searchText = '';
            $scope.filter = filter;
        };

        $scope.modal = {
            amount: 0,
            resolved: false
        };
        $scope.resolved = false;

        $scope.pushResolved = function (resolved) {
            $scope.modal.resolved = resolved;
            if ($scope.modal.resolved) $scope.modal.amount = $scope.debt.value;
            else $scope.modal.amount = 0;
        };


        $scope.resolveDebt = function(debt) {
            var title;
            if (debt.debtor == $scope.user.id) title = 'Do you confirm that you payed ' + debt.creditor + ' ' + debt.value + ' ' + debt.currency + ' and thus resolved the debt?';
            else title= 'Do you confirm that ' + debt.debtor + ' payed you ' + debt.value + ' ' + debt.currency + ' and resolved the debt ?';
            $ionicPopup.show({
                title: title ,
                scope: $scope,
                buttons: [
                    {
                        text: 'Yes',
                        type: 'button-balanced',
                        onTap: function (e) {
                            return true;
                        }
                    },
                    {
                        text: 'Cancel',
                        type: 'button-assertive',
                        onTap: function (e) {
                            return false;
                        }
                    }
                ]
            }).then(function (res) {
                if (res) {

                    var newDebt = {
                        value: 0,
                        currency: debt.currency
                    }

                    Restangular.one('users', $scope.user.id).all('debts').all(debt.debtId).patch(newDebt).then(function (data) {
                        $scope.closeDebtModal();
                        $scope.reloadDebts();
                    }, function (response) {
                        AlertPopupService.createPopup('Error', response.error);
                    });

                }

            });
        }

        $scope.deleteDebt = function(debt) {

            $ionicPopup.show({
                title: 'Are you sure you want to delete this debt?',
                scope: $scope,
                buttons: [
                    {
                        text: 'Yes, delete it',
                        type: 'button-balanced',
                        onTap: function (e) {
                            return true;
                        }
                    },
                    {
                        text: 'Cancel',
                        type: 'button-assertive',
                        onTap: function (e) {
                            return false;
                        }
                    }
                ]
            }).then(function (res) {
                if (res) {
                    Restangular.one('users', $stateParams.userId).one('debts',debt.debtId).remove().then(function (data) {
                        $scope.closeDebtModal();
                        $scope.reloadDebts();
                    });
                }

            });

        };

        $scope.updateDebt = function(debt,amount) {

            var title;
            if (debt.debtor == $scope.user.id) title = 'Do you confirm that you payed ' + debt.creditor + ' ' + amount + ' ' + debt.currency + ', but still owe  him/her ' + (debt.value - amount) + ' ' + debt.currency + ' ?';
            else title= 'Do you confirm that ' + debt.debtor + ' payed you ' + amount + ' ' + debt.currency + ', but is still owing you ' + (debt.value - amount) + ' ' + debt.currency + ' ?';
                $ionicPopup.show({
                title: title ,
                scope: $scope,
                buttons: [
                    {
                        text: 'Yes',
                        type: 'button-balanced',
                        onTap: function (e) {
                            return true;
                        }
                    },
                    {
                        text: 'Cancel',
                        type: 'button-assertive',
                        onTap: function (e) {
                            return false;
                        }
                    }
                ]
            }).then(function (res) {
                if (res) {

                    var newDebt = {
                        value: debt.value - amount,
                        currency: debt.currency
                    };

                    Restangular.one('users', $scope.user.id).all('debts').all(debt.debtId).patch(newDebt).then(function (data) {
                        $scope.closeDebtModal();
                        $scope.reloadDebts();
                    }, function (response) {
                        AlertPopupService.createPopup('Error', response.data.error);
                    });

                }

            });

        };

        $scope.debts = []; // this is needed to keep reference constant
        $scope.user = AuthService.currentUser();

        var dataStore = new DevExpress.data.ArrayStore({
            key: 'name',
            data: [
                { name: 'Credit', value: 0 },
                { name: 'Debit', value: 0 }
            ]
        });

        var dataSource = new DevExpress.data.DataSource(dataStore);

        $scope.chartOptions = {
            dataSource: dataSource,
            size: {
                height: 270
            },
            tooltip: {
                enabled: false
            },
            legend: {
                visible: false
            },
            series: [
                {
                    argumentField: 'name',
                    valueField: 'value',
                    label: {
                        visible: true,
                        connector: {
                            visible: false,
                            width: 0.5
                        },
                        position: 'inside',
                        radialOffset: -20,
                        customizeText: function (arg) {
                            return arg.argumentText + ": " + arg.valueText + " € ";
                        },
                        font: {
                            size: '15px'
                        }
                    },
                    border: {
                        width: 2,
                        visible: true
                    },
                    hoverStyle: {
                        border: {
                            width: 2,
                            visible: true
                        }
                    }
                }
            ]
        };





        $scope.reloadDebts = function () {
            Restangular.one('users', $stateParams.userId).one('debts').get().then(function (data) {

                $scope.debts = [];
                $scope.loading = false;
                $scope.debts = data;

                if ($scope.openDebt) {

                    var id = $scope.openDebt;
                    $scope.openDebt = null;

                    $scope.debts.debts.forEach(function (debt) {
                        if (debt.debtId == id) {
                            $scope.openDebtModal(debt);
                        }

                    });
                }


                dataStore.update('Credit', { value: data.credit });
                dataStore.update('Debit', { value: data.debit });
                dataSource.load();

            });
        };


        $scope.friendsModal;


        $ionicModal.fromTemplateUrl('templates/debtsFriendsModal.html', function (modal) {
            $scope.friendsModal = modal;
        }, {
            scope: $scope,  /// Give the modal access to the parent scope
            animation: 'slide-in-up',
            focusFirstInput: true
        });


        $scope.openFriendsModal = function () {
            $ionicPopup.show({
                title: 'Someone is owing you money?',
                scope: $scope,
                buttons: [
                    {
                        text: 'I owe money',
                        type: 'button-positive',
                        onTap: function (e) {
                            return true;
                        }
                    },
                    {
                        text: 'Someone owes me',
                        type: 'button-calm',
                        onTap: function (e) {
                            return false;
                        }
                    }
                ]
            }).then(function (res) {
                Restangular.one('users', $stateParams.userId).one('friends').get().then(function (data) {
                    $scope.friends = data.friends;
                    $scope.owingMoney = res;

                    if ($scope.friends.length == 0) {
                        AlertPopupService.createPopup("No friends :(", "You need to add a friend before creating a debt", function() {$state.go('app.friends',{userId: $scope.user.id})} );
                    }
                    else
                        $scope.friendsModal.show();

                });


            });
        };



        $scope.checkCheckedFriends = function () {
            if (!$scope.friends)
                return false;

            return _.some($scope.friends, function (f) {
                return f.isChecked;
            });
        };

        $scope.canRemoveIsChecked = function () {
            return $scope.countCheckedPayingFriends >= 2;
        };

        $scope.countCheckedPayingFriends = function () {
            if (!$scope.friends)
                return 0;

            return _.countBy($scope.friends, function (f) {
                return f.isChecked;
            }).true;
        };

        $scope.closeFriendsModal = function () {
            $scope.friendsModal.hide();
            $scope.friends = [];
        };

        $scope.closeDebtModal = function () {
            $scope.debtModal.hide();
        };

        $ionicModal.fromTemplateUrl('templates/debtsCreateModal.html', function (modal) {
            $scope.createDebtModal = modal;
        }, {
            scope: $scope,  /// Give the modal access to the parent scope
            animation: 'slide-in-up',
            focusFirstInput: true
        });

        $scope.openCreateDebtModal = function () {
            $scope.createDebtModal.show();
        };

        $scope.closeCreateDebtModal = function () {
            $scope.createDebtModal.hide();
        };

        $scope.commitEnabled = true;

        $scope.changeCommit = function (enabled) {
            $scope.commitEnabled = enabled;
        };

        $scope.commitStatus = function () {
            return   $scope.commitEnabled;
        };

        $scope.commitDebts = function (amount, description) {
            $scope.changeCommit(false);

            $scope.friends.forEach(function (friend) {
                if (!friend.isChecked)
                    return;

                if ($scope.owingMoney) {
                    creditor = $stateParams.userId;
                    debitor = friend.id;
                }
                else {
                    creditor = friend.id;
                    debitor = $stateParams.userId;
                }


                Restangular.one('users', debitor).all('debts').post({
                    user: creditor,
                    value: amount / $scope.countCheckedPayingFriends(),
                    description: description,
                    currency: AuthService.currentUser().currency
                }).then(function (data) {
                    $scope.closeCreateDebtModal();
                    $scope.closeFriendsModal();
                    $scope.changeCommit(true);
                    $scope.reloadDebts();
                    // AlertPopupService.createPopup('Success!', 'New debt created!');

                }, function (response) {
                    AlertPopupService.createPopup('Error', response.error);
                    $scope.changeCommit(true);

                });
            });

        };

        $scope.friendsModal;
        // Cleanup the modal when we're done with it (avoid memory leaks)
        $scope.$on('$destroy', function () {
            $scope.debts = [];
            $scope.friends = [];
            if (typeof $scope.friendsModal != 'undefined') $scope.friendsModal.remove();
            if (typeof $scope.createDebtModal != 'undefined') $scope.createDebtModal.remove();
            if (typeof $scope.debtModal != 'undefined') $scope.debtModal.remove();
        });


        $scope.openDebtModal = function (debt) {
            $ionicModal.fromTemplateUrl('templates/debtModal.html', function (modal) {
                $scope.debtModal = modal;
                $scope.debt = debt;
                $scope.modal.resolved = false;
                $scope.resolved = false;
                $scope.modal.amount = 0;
                $scope.debtModal.show();

            }, {
                scope: $scope,  /// Give the modal access to the parent scope
                animation: 'slide-in-up',
                focusFirstInput: true,
                resolved: true
            });


        };

        $scope.reloadDebts();

    })

    .controller('FriendsCtrl', function ($scope, $stateParams, $ionicModal, Restangular, AuthService, AlertPopupService) {
        $scope.friends = [];
        $scope.loading = true;
        $scope.userId = $stateParams.userId;

        if (AuthService.currentUser())
            $scope.currentUserId = AuthService.currentUser().id;

        $scope.isOwner = function (userId) {
            return $stateParams.userId === userId;
        };

        if ($stateParams.userId == $scope.currentUserId || !$stateParams.userId)
            $scope.title = 'Friends';
        else  $scope.title = $stateParams.userId + "'s friends";

        $scope.data = {
            showDelete: false
        };

        $scope.addingFriends = [];

        $scope.onFriendDelete = function (friend) {

            Restangular.one('users', $stateParams.userId).one('friends', friend.id).remove().then(
                function (data) {
                    var idx = $scope.friends.indexOf(friend);
                    if (idx != -1) {
                        $scope.friends.splice(idx, 1);
                        if ($scope.friends.length == 0)  $scope.data.showDelete = false;
                    }
                },
                function (response) {
                    AlertPopupService.createPopup('Error', response.error);
                });
        };

        $scope.isFriend = function (user) {
            return _.some($scope.friends, function (friend) {
                return user.id === friend.id;
            });
        };

        $ionicModal.fromTemplateUrl('templates/searchModal.html', function (modal) {
            $scope.modal = modal;
        }, {
            scope: $scope,  /// Give the modal access to the parent scope
            animation: 'slide-in-up',
            focusFirstInput: true
        });

        $scope.openModal = function () {
            $scope.modal.show();
        };

        $scope.closeModal = function () {
            $scope.modal.hide();
            $scope.users = [];
        };

        // Cleanup the modal when we're done with it (avoid memory leaks)
        $scope.$on('$destroy', function () {
            $scope.users = [];
            $scope.modal.remove();
        });

        $scope.addFriend = function (user) {
            if ($scope.addingFriends.indexOf(user) == -1) {
                $scope.addingFriends.push(user);
                Restangular.one('users', $stateParams.userId).all('friends').post({ id: user.id }).then(
                    function (data) {
                        $scope.addingFriends.splice($scope.addingFriends.indexOf(user), 1);
                        $scope.friends.push(user);

                    },
                    function (response) {
                        AlertPopupService.createPopup('Error', response.error);
                        $scope.addingFriends.splice($scope.addingFriends.indexOf(user), 1);

                    });
            }
        };

        $scope.searchUsers = function (textSearch) {

            if (textSearch.length === 0) {
                $scope.users = [];
                return;
            }

            Restangular.one('users').get({ "search": textSearch, "self": false }).then(function (data) {
                $scope.users = data.users;
            });
        };

        Restangular.one('users', $stateParams.userId).one('friends').get().then(function (data) {
            $scope.friends = data.friends;
            $scope.loading = false;
        });
    })

    .controller('MapCtrl', function ($scope, $ionicLoading, AlertPopupService) {

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
            var mapOptions = {
                center: new google.maps.LatLng(43.07493, -89.381388),
                zoom: 16,
                mapTypeId: google.maps.MapTypeId.ROADMAP
            };
            var map = new google.maps.Map(document.getElementById("map"),
                mapOptions);

            // Stop the side bar from dragging when mousedown/tapdown on the map
            google.maps.event.addDomListener(document.getElementById('map'), 'mousedown', function (e) {
                e.preventDefault();
                return false;
            });

            $scope.map = map;
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
