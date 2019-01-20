const express = require('express');
const router = express.Router();
const passport = require('passport');
const Trx = require('../models/transaction');
const Game = require('../models/game');
const LocalGame = require('../models/local-game');
const Prop = require('../models/prop');
const User = require('../models/user');
const functions = require('../includes/functions');
const values = require('../includes/values');
const async = require('async');
const bcrypt = require('bcryptjs');
const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

// Create Account
router.post('/register', (req, res) => {
    try {
        const referrer = req.body.referrer.trim();
        const username = req.body.username.trim();
        const phone = req.body.phone.trim();
        const password = req.body.password;
        const ads = req.body.ads.trim();
        const adc = req.body.adc.trim();

        if (referrer == undefined || username == undefined || phone == undefined || password == undefined) return res.json({ success: false, error: 'Bad Request' });

        if (referrer != '-' && !functions.isValidPhoneNumber(referrer).success) return res.json({ success: false, error: 'Invalid Referral Link' });

        if (!functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: functions.isValidPhoneNumber(phone).error });

        if (!functions.isValidUsername(username).success) return res.json({ success: false, error: functions.isValidUsername(username).error });
        
        if (!functions.isValidPassword(password).success) return res.json({ success: false, error: functions.isValidPassword(password).error });

        if (ads == '') return res.json({ success: false, error: 'Invalid State' });

        if (adc == '') return res.json({ success: false, error: 'Invalid City' });
        
        const newUser = { referrer, s: functions.getS(phone), username, phone, password, ads, adc };

        async.waterfall([
            (callback) => {
                if (referrer != '-') User.userExists(false, referrer, callback);
                else callback(null, true);
            },
            (exists, callback) => {
                if (!exists) callback('Invalid Referral Link');
                else callback(null);
            },
            (callback) => User.userExists(false, phone, callback),
            (exists, callback) => {
                if (exists) callback('Phone Number already registered');
                else callback(null);
            },
            (callback) => bcrypt.genSalt(10, callback),
            (salt, callback) => bcrypt.hash(password, salt, callback),
            (hash, callback) => {
                newUser.password = hash;

                Prop.updateN('V', 500, (err) => {
                    if (err) callback(err);
                    else {
                        if (referrer != '-') {
                            User.updateUnder(referrer, { username, phone }, (err) => {
                                if (err) callback(err);
                                else User.addUser(newUser, callback);
                            });
                        }

                        else User.addUser(newUser, callback);
                    }
                });
            },
        ], (err, userDoc) => {
            if (err) return res.json({ success: false, error: err });

            try {
                fs.copySync(path.resolve(__dirname, '../public/userdata/'+functions.getRandomNumber(1, 9)+'.jpg'), path.resolve(__dirname, '../public/userdata/u'+phone+'.jpg'));
            } catch (err) {
                console.error(err);
            }
            
            return res.json({ success: true, token: functions.getToken(userDoc) });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// User Login
router.post('/login', (req, res) => {
    try {
        const phone = req.body.phone.trim();
        const password = req.body.password;

        if (phone == undefined || password == undefined) return res.json({ success: false, error: 'Bad Request' });

        if (!functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: functions.isValidPhoneNumber(phone).error });
        
        if (password == '') return res.json({ success: false, error: 'Password cannot be blank' });

        let user;
        async.waterfall([
            (callback) => User.getUser(phone, callback),
            (userDoc, callback) => {
                if (userDoc == null) callback('User not found');
                else {
                    user = userDoc;
                    bcrypt.compare(password, user.password, callback);
                }
            },
            (matches, callback) => {
                if (!matches) callback('Incorrect Password');
                else callback(null, functions.getToken(user));
            }
        ], (err, token) => {
            if (err) return res.json({ success: false, error: err });

            return res.json({ success: true, token, user });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// Update Password
router.post('/update-password', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const phone = req.user.phone.trim();
        const current = req.body.current;
        const password = req.body.password;

        if (username == undefined || current == undefined || password == undefined) return res.json({ success: false, error: 'Bad Request' });

        if (!functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: functions.isValidPhoneNumber(phone).error });
        
        if (!functions.isValidPassword(password).success) return res.json({ success: false, error: functions.isValidPassword(password).error });

        let user;
        async.waterfall([
            (callback) => User.getUser(phone, callback),
            (userDoc, callback) => {
                if (userDoc == null) callback('User not found');
                else {
                    user = userDoc;
                    bcrypt.compare(current, user.password, callback);
                }
            },
            (matches, callback) => {
                if (!matches) callback('Incorrect Current Password');
                else bcrypt.genSalt(10, callback);
            },
            (salt, callback) => bcrypt.hash(password, salt, callback),
            (hash, callback) => User.updatePassword(username.toLowerCase(), hash, callback),
            (callback) => User.getUser(phone, callback)
        ], (err, nu) => {
            if (err) return res.json({ success: false, error: err });

            return res.json({ success: true, user: nu, token: functions.getToken(nu) });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// Profile of logged in user
router.get('/profile', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        res.json({ success: req.user.username != null, user: req.user });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// Coin balance of logged in user
router.get('/coins', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        res.json({ success: req.user.coins != null, coins: req.user.virt, diamonds: req.user.coins });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// transactions of logged in user
router.get('/transactions', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        const phone = aUser.phone;
        
        User.getUserTrx(phone, (err, user) => {
            if (err) return res.json({ success: false, error: 'Bad Request' });

            if (user == null) return res.json({ success: false, error: 'User not found' });

            Trx.getArray(user.trx, (err, docs) => {
                if (err) return res.json({ success: false, error: 'Error getting transactions' });

                return res.json({ success: true, docs });
            });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// games of logged in user
router.get('/games', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        const phone = aUser.phone;
        
        User.getUserGames(phone, (err, user) => {
            if (err) return res.json({ success: false, error: 'Bad Request' });

            if (user == null) return res.json({ success: false, error: 'User not found' });

            Game.getArray(user.games, (err, docs) => {
                if (err) return res.json({ success: false, error: 'Error getting games' });

                return res.json({ success: true, docs });
            });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// local games of logged in user
router.get('/local-games', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        const phone = aUser.phone;
        
        User.getUserLocalGames(phone, (err, user) => {
            if (err) return res.json({ success: false, error: 'Bad Request' });

            if (user == null) return res.json({ success: false, error: 'User not found' });

            LocalGame.getArray(user.localGames, (err, docs) => {
                if (err) return res.json({ success: false, error: 'Error getting games' });

                return res.json({ success: true, docs });
            });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// Withdrawal requests
router.get('/withdrawal-requests', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        const phone = aUser.phone;
        
        User.getUserTrx(phone, (err, user) => {
            if (err) return res.json({ success: false, error: 'Bad Request' });

            if (user == null) return res.json({ success: false, error: 'User not found' });

            console.log(user);
            
            Trx.getTypeArray(user.trx, 4, (err, docs) => {
                if (err) return res.json({ success: false, error: 'Error getting transactions' });

                return res.json({ success: true, docs });
            });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// withdraw request
router.get('/withdraw', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 2) return res.json({ success: false, error: 'Bad Request' });
        
        const phone = aUser.phone;
        const amt = aUser.coins / values.coinRate;

        if (amt < 1000) return res.json({ success: false, error: 'Not enough coins' });
        
        async.waterfall([
            (callback) => User.updateCoins(phone, -aUser.coins, callback),
            (callback) => User.updateDue(phone, amt, callback),
            (callback) => {
                User.getAdmin((err, admin) => {
                    if (err) callback('Error submitting request');

                    else {
                        Trx.add({ sender: admin, receiver: phone, amount: amt, type: 4, status: 0 }, (err, doc) => {
                            if (err || doc == null) callback('Error submitting request');

                            else {
                                User.addTrx(phone, doc._id, (err) => {
                                    if (err) callback('Error submitting request');
                                    else User.addTrx(admin, doc._id, callback);
                                });
                            }
                        });
                    }
                });
            },
            (callback) => Prop.updateN('D', -aUser.coins, callback)
        ], (err) => {
            if (err) return res.json({ success: false, error: err });

            return res.json({ success: true });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// latest transactions
router.get('/latest-transactions', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        
        const phone = aUser.phone;
        
        User.getUserTrx(phone, (err, user) => {
            if (err) return res.json({ success: false, error: 'Bad Request' });

            if (user == null) return res.json({ success: false, error: 'User not found' });

            Trx.getRecent(user.trx, (err, docs) => {
                if (err) return res.json({ success: false, error: 'Error getting transactions' });

                return res.json({ success: true, docs });
            });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// latest games
router.get('/latest-games', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        
        const phone = aUser.phone;
        
        User.getUserGames(phone, (err, user) => {
            if (err) return res.json({ success: false, error: 'Bad Request' });

            if (user == null) return res.json({ success: false, error: 'User not found' });

            Game.getRecent(user.games, (err, docs) => {
                if (err) return res.json({ success: false, error: 'Error getting transactions' });

                return res.json({ success: true, docs });
            });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// add friend
router.get('/add-friend/:f', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 2) return res.json({ success: false, error: 'Bad Request' });

        let f = req.params.f;
        if (f == undefined) return res.json({ success: false, error: 'Bad Request' });
        
        // let f = req.body.f.toLowerCase();
        // if (f == undefined) return res.json({ success: false, error: 'Bad Request' });

        let username;
        async.waterfall([
            (callback) => User.getUser(f, callback),
            (userDoc, callback) => {
                if (userDoc == null) callback('User not found');
                else {
                    username = userDoc.username;
                    
                    let isFriend = false;
                    for (let b = 0; b < aUser.friends.length; b++) {
                        if (aUser.friends[b].phone == f) {
                            isFriend = true;
                            break;
                        }
                    }

                    if (isFriend) callback('You\'re already friends');
                    else callback(null);
                }
            },
            (callback) => User.addFriend(aUser.phone, { phone: f, username }, callback)
        ], (err) => {
            if (err) return res.json({ success: false, error: err });
            
            return res.json({ success: true, username });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// upload photo
router.post('/photo', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 1 && aUser.role != 2) return res.json({ success: false, error: 'Bad Request' });

        const image = req.body.image;

        if (image == undefined) return res.json({ success: false, error: 'Bad Request' });

        const base64Data = image.replace(/^data:image\/jpeg;base64,/, '');

        fs.writeFile(path.resolve(__dirname, '../public/userdata/u'+aUser.phone+'.jpg'), base64Data, 'base64', (err) => {
            if (err) {
                console.log(err);
                return res.json({ success: false, error: 'Cannot upload image' });
            } else {
                return res.json({ success: true });
            }
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// daily reward request
router.get('/daily-reward', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 1 && aUser.role != 2) return res.json({ success: false, error: 'Bad Request' });

        let reward = 0;
        
        async.waterfall([
            (callback) => User.getValues(aUser.phone, 'rewarded', callback),
            (userDoc, callback) => {
                if (userDoc == null) callback('User not found');

                const lastReward = moment(new Date(userDoc.rewarded));
                const timeRn = moment(new Date());
                const diff = timeRn.diff(lastReward, 'hours');

                console.log(`Rewarded ${diff} hours ago`);
                callback(null, diff);
            },
            (diff, callback) => {
                if (diff >= 24) {
                    reward = 500;
                    User.updateCoinsOfSingle(0, aUser.phone, reward, (err) => {
                        if (err) callback('Error processing reward');
                        else {
                            User.updateOne({ phone: aUser.phone }, { $set: { rewarded: Date.now() } }, callback);
                        }
                    });
                } else {
                    callback(null);
                }
            },
            (_, callback) => {
                if (reward > 0) {
                    Prop.updateN('V', 500, callback);
                } else {
                    callback(null);
                }
            }
        ], (err) => {
            if (err) return res.json({ success: false, error: err });
            
            return res.json({ success: true, reward });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// Start Local Game
router.post('/start-local', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 2) return res.json({ success: false, error: 'Bad Request' });

        const phone = aUser.phone;
        const players = req.body.players;
        const bet = req.body.bet;

        if (players == undefined || bet == undefined) return res.json({ success: false, error: 'Bad Request 1' });

        if (!functions.isArray(players) || (players.length != 2 && players.length != 4)) return res.json({ success: false, error: 'Bad Request 2' });

        // const localBetKinds = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
        if (isNaN(bet)/* || localBetKinds.indexOf(bet) < 0*/) return res.json({ success: false, error: 'Invalid Bet Amount' });

        const gameData = { phone, players, bet };

        let gameId;
        async.waterfall([
            (callback) => LocalGame.add(gameData, callback),
            (gameDoc, callback) => {
                gameId = gameDoc._id;
                callback(null);
            },
            (callback) => User.addLocalGame(phone, gameId, callback),
            (callback) => Prop.get('color', callback)
        ], (err, doc) => {
            if (err) return res.json({ success: false, error: err });

            return res.json({ success: true, gameId, color: doc == null ? '-' : values.colors[doc.n] });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request D' });
    }
});

// Local game result submit
router.post('/local-result', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 2) return res.json({ success: false, error: 'Bad Request' });

        const phone = aUser.phone;
        const winner = req.body.winner;
        const gameId = req.body.gameId;

        if (winner == undefined || gameId == undefined) return res.json({ success: false, error: 'Bad Request' });

        // if (isNaN(winner)) return res.json({ success: false, error: 'Bad Request' });
        
        async.waterfall([
            (callback) => LocalGame.verifyOwner(gameId, phone, callback),
            (callback) => LocalGame.complete(gameId, winner, callback)
        ], (err) => {
            if (err) return res.json({ success: false, error: err });

            return res.json({ success: true });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

module.exports = router;