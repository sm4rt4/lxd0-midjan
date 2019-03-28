const express = require('express');
const router = express.Router();
const passport = require('passport');
const async = require('async');
const User = require('../models/user');
const Trx = require('../models/transaction');
const Game = require('../models/game');
const LocalGame = require('../models/local-game');
const Prop = require('../models/prop');
const functions = require('../includes/functions');
const values = require('../includes/values');
const bcrypt = require('bcryptjs');

// admin exists
router.get('/exists', (_, res) => {
    try {
        User.adminExists((err, exists) => {
            if (err) return res.json({ success: false, error: 'Unknown Error' });
            else res.json({ success: true, exists });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Unknown Error' });
    }
});

// register
router.post('/register', (req, res) => {
    try {
        const username = req.body.username.trim();
        const phone = req.body.phone.trim();
        const password = req.body.password;

        if (username == undefined || phone == undefined || password == undefined) return res.json({ success: false, error: 'Bad Request' });

        if (!functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: functions.isValidPhoneNumber(phone).error });

        if (!functions.isValidUsername(username).success) return res.json({ success: false, error: functions.isValidUsername(username).error });

        if (!functions.isValidPassword(password).success) return res.json({ success: false, error: functions.isValidPassword(password).error });

        const newUser = { s: functions.getS(phone), username, phone, password, role: 0, ads: '-', adc: '-', myr: values.firstStr };

        async.waterfall([
            (callback) => User.adminExists(callback),
            (exists, callback) => {
                if (exists) callback('Bad Request');
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
                User.addUser(newUser, callback);
            }
        ], (err, userDoc) => {
            if (err) {
                console.log(err);
                return res.json({ success: false, error: err });
            }

            return res.json({ success: true, token: functions.getToken(userDoc), user: userDoc });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// get users
router.get('/users/:role/:page', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        
        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        const role = req.params.role;
        if (role != 1 && role != 2) return res.json({ success: false, error: 'Bad Request' });
        
        let page = req.params.page;
        if (page == undefined || isNaN(page)) page = 0;

        User.getUsers(role, page, (err, docs) => {
            if (err) return res.json({ success: false, error: 'Bad Request' });
            return res.json({ success: true, docs });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// get single user
router.get('/users/:phone', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        
        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        const phone = req.params.phone.trim();
        if (phone == undefined || !functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: 'Bad Request' });
        
        User.getUser(phone, (err, user) => {
            if (err) return res.json({ success: false, error: 'Bad Request' });

            if (user == null) return res.json({ success: false, error: 'User not found' });

            return res.json({ success: true, user });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// transactions of a user
router.get('/user-transactions/:phone', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        
        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        const phone = req.params.phone.trim();
        if (phone == undefined || !functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: 'Bad Request' });
        
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

// transactions of a user
router.get('/user-games/:phone', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        
        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        const phone = req.params.phone.trim();
        if (phone == undefined || !functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: 'Bad Request' });
        
        User.getUserGames(phone, (err, user) => {
            if (err) return res.json({ success: false, error: 'Bad Request' });

            if (user == null) return res.json({ success: false, error: 'User not found' });

            Game.getArray(user.games, (err, docs) => {
                if (err) return res.json({ success: false, error: 'Error getting games' });

                // let _docs = [
                //     {players: ['devanshu', 'dev', 'deepak', 'manish'], winner: 'dev', bet: 1000, time: '2018-10-19T15:45:35.909Z'},
                //     {players: ['manish', 'jaya'], winner: 'manish', bet: 500, time: '2018-10-19T15:04:04.909Z'}
                // ];

                return res.json({ success: true, docs: docs });
            });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// payment
router.post('/payment', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        const phone = req.body.phone.trim();
        const amount = req.body.amount;
        
        if (phone == undefined || amount == undefined) return res.json({ success: false, error: 'Bad Request' });

        if (!functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: functions.isValidPhoneNumber(phone).error });

        if (isNaN(amount) || amount < 1) return res.json({ success: false, error: 'Amount invalid' });

        const trxData = { sender: aUser.phone, receiver: phone, amount, type: 5 };

        let trx;
        async.waterfall([
            (callback) => User.getUser(phone, callback),
            (userDoc, callback) => {
                if (userDoc == null) callback('User not found');
                else {
                    if (amount > userDoc.due) {
                        callback('Amount exceeds due amount');
                    }
                    else {
                        User.updateDue(userDoc.u, -amount, callback);
                    }
                }
            },
            (callback) => Trx.add(trxData, callback),
            (doc, callback) => {
                trx = doc;
                User.addTrx(aUser.phone, trx._id, callback);
            },
            (callback) => User.addTrx(phone, trx._id, callback)
        ], (err) => {
            if (err) return res.json({ success: false, error: err });

            return res.json({ success: true, trx });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// transactions
router.get('/transactions/:page', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        let page = req.params.page;
        if (page == undefined || isNaN(page)) page = 0;

        Trx.getMultiple(page, (err, docs) => {
            if (err) return res.json({ success: false, error: 'Error retrieving transactions' });
            return res.json({ success: true, docs });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// transactions by status
router.get('/transactions-by-status/:status/:page', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        let page = req.params.page;
        if (page == undefined || isNaN(page)) page = 0;

        let status = req.params.status;
        if (status == undefined || isNaN(status)) status = 0;

        Trx.getByStatus(status, page, (err, docs) => {
            if (err) return res.json({ success: false, error: 'Error retrieving transactions' });
            return res.json({ success: true, docs });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// transactions by type
router.get('/transactions-by-type/:type/:page', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        let page = req.params.page;
        if (page == undefined || isNaN(page)) page = 0;

        let type = req.params.type;
        if (type == undefined || isNaN(type)) type = 0;

        Trx.getByType(type, page, (err, docs) => {
            if (err) return res.json({ success: false, error: 'Error retrieving transactions' });
            return res.json({ success: true, docs });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// transactions involving recharge
router.get('/recharge-transactions/:page', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        let page = req.params.page;
        if (page == undefined || isNaN(page)) page = 0;

        Trx.rechargeTransactions(page, (err, docs) => {
            if (err) return res.json({ success: false, error: 'Error retrieving transactions' });
            return res.json({ success: true, docs });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// games
router.get('/games/:page', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        let page = req.params.page;
        if (page == undefined || isNaN(page)) page = 0;

        Game.getMultiple(page, (err, docs) => {
            if (err) return res.json({ success: false, error: 'Error retrieving games' });
            return res.json({ success: true, docs });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// local games
router.get('/local-games/:page', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        let page = req.params.page;
        if (page == undefined || isNaN(page)) page = 0;

        LocalGame.getMultiple(page, (err, docs) => {
            if (err) return res.json({ success: false, error: 'Error retrieving games' });
            return res.json({ success: true, docs });
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

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        Trx.getLatest((err, docs) => {
            if (err) return res.json({ success: false, error: 'Error retrieving transactions' });
            return res.json({ success: true, docs });
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

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        Game.getLatest((err, docs) => {
            if (err) return res.json({ success: false, error: 'Error retrieving games' });
            return res.json({ success: true, docs });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// get winning color
router.get('/get-color', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        Prop.get('color', (err, doc) => {
            if (err || doc == null) return res.json({ success: false, error: 'Not Set' });
            else return res.json({ success: true, color: doc.n });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// set winning color
router.get('/set-color/:color', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        let color = req.params.color;
        if (color == undefined || isNaN(color) || color < 0 || (color > 3 && color != 8)) return res.json({ success: false, error: 'Bad Request' });

        Prop.setN('color', color, (err, doc) => {
            if (err || doc == null) return res.json({ success: false, error: 'Error updating data' });
            else return res.json({ success: true });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// Update a User's Password
router.post('/update-user-password', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        const phone = req.body.phone.trim();
        const password = req.body.password;

        if (phone == undefined || password == undefined) return res.json({ success: false, error: 'Bad Request 2' });

        if (!functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: functions.isValidPhoneNumber(phone).error });        

        if (!functions.isValidPassword(password).success) return res.json({ success: false, error: functions.isValidPassword(password).error });

        async.waterfall([
            (callback) => User.userExists(false, phone, callback),
            (exists, callback) => {
                if (!exists) callback('User not found');
                else bcrypt.genSalt(10, callback);
            },
            (salt, callback) => bcrypt.hash(password, salt, callback),
            (hash, callback) => User.updatePassword(phone, hash, callback)
        ], (err) => {
            if (err) return res.json({ success: false, error: err });

            return res.json({ success: true });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// Agent Recharge
router.post('/agent-recharge', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        const phone = req.body.phone.trim();
        const amount = req.body.amount;
        
        if (phone == undefined || amount == undefined) return res.json({ success: false, error: 'Bad Request' });

        if (!functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: functions.isValidPhoneNumber(phone).error });

        if (isNaN(amount) || amount <= 0) return res.json({ success: false, error: 'Amount invalid' });

        const trxData = { sender: aUser.phone, receiver: phone, amount, type: 7 };

        let trx;
        async.waterfall([
            (callback) => User.getUser(phone, callback),
            (userDoc, callback) => {
                if (userDoc == null) callback('User not found');
                else if (!userDoc.agent) callback('User is not an agent');
                else callback(null);
            },
            (callback) => User.updateSpecialCoins(phone, amount * values.coinRate, callback),
            (callback) => Trx.add(trxData, callback),
            (doc, callback) => {
                trx = doc;
                User.addTrx(aUser.phone, trx._id, callback);
            },
            (callback) => User.addTrx(phone, trx._id, callback),
            (callback) => Prop.updateN('D', amount * values.coinRate, callback)
        ], (err) => {
            if (err) return res.json({ success: false, error: err });

            return res.json({ success: true, trx });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// User recharge
router.post('/recharge', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        const phone = req.body.phone.trim();
        const amount = req.body.amount;
        const cType = req.body.c;
        const rType = req.body.r;
        
        if (phone == undefined || amount == undefined || cType == undefined || rType == undefined) return res.json({ success: false, error: 'Bad Request' });

        if (isNaN(cType) || cType < 0 || cType > 1) return res.json({ success: false, error: 'Bad Request' });

        if (isNaN(rType) || rType < 0 || rType > 1) return res.json({ success: false, error: 'Bad Request' });
        
        if (rType == 1 && !functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: functions.isValidPhoneNumber(phone).error });

        if (isNaN(amount) || amount < 1) return res.json({ success: false, error: 'Amount invalid' });

        const trxData = { sender: aUser.phone, receiver: rType == 0 ? 'a' : phone, amount, type: cType == 1 ? 1 : 6 };

        let trx, referrer;
        async.waterfall([
            (callback) => {
                if (rType == 1) User.getUser(phone, callback);
                else callback(null, null);
            },
            (userDoc, callback) => {
                if (rType == 1 && userDoc == null) callback('User not found');
                else if (rType == 1 && userDoc.role != 2) callback('User is not a player');
                else {
                    if (rType == 1) referrer = userDoc.referrer;
                    callback(null);
                }
            },
            (callback) => {
                if (rType == 0) User.updateCoinsOfAll(cType, amount * values.coinRate, callback);
                else User.updateCoinsOfSingleOnRecharge(cType, phone, amount * values.coinRate, callback);
                // else User.updateCoinsOfSingleOnRecharge(cType, phone, amount * values.coinRate, callback);
                //updateCoinsOfSingleOnRecharge
            },
            (callback) => Trx.add(trxData, callback),
            (doc, callback) => {
                trx = doc;
                User.addTrx(aUser.phone, trx._id, callback);
            },
            (callback) => {
                if (rType == 0) User.addTrxForAll(trx._id, callback);
                else User.addTrx(phone, trx._id, callback);
            },
            (callback) => {
                console.log(`referrer - ${JSON.stringify(referrer)}`);

                if (cType == 1) {
                    if (rType == 1 && Object.keys(referrer).length > 0) { // single user
                        let cAmount = functions.getPercentAmount(amount * values.coinRate, values.rechargeCommisions[0]);
                        
                        async.waterfall([
                            // give 20% commission to 1st referrer
                            (callback) => User.updateCoinsOfSingle(1, referrer.phone, cAmount, callback),
                            // coins in total record
                            (callback) => Prop.updateN('D', cAmount, callback),
                            // get 2nd referrer
                            (_, callback) => User.getValues(referrer.phone, 'referrer', callback),
                            (doc, callback) => {
                                if (doc != null) {
                                    console.log(doc);

                                    if (Object.keys(doc.referrer).length === 0) callback('D');
                                    else {
                                        referrer = doc.referrer;
                                        callback(null);
                                    }
                                }
                                else callback('Error processing commission');
                            },
                            // give 5% commision to 2nd referrer
                            (callback) => {
                                cAmount = functions.getPercentAmount(amount * values.coinRate, values.rechargeCommisions[1]);
                                User.updateCoinsOfSingle(1, referrer.phone, cAmount, callback);
                            },
                            // coins in total record
                            (callback) => Prop.updateN('D', cAmount, callback),
                            // get 3rd referrer
                            (_, callback) => User.getValues(referrer.phone, 'referrer', callback),
                            (doc, callback) => {
                                if (doc != null) {
                                    console.log(doc);

                                    // if (doc.referrer == {}) callback('D');
                                    if (Object.keys(doc.referrer).length === 0) callback('D');
                                    else {
                                        referrer = doc.referrer;
                                        callback(null);
                                    }
                                }
                                else callback('Error processing commission');
                            },
                            // give 5% commision to 3rd referrer
                            (callback) => {
                                cAmount = functions.getPercentAmount(amount * values.coinRate, values.rechargeCommisions[2]);
                                User.updateCoinsOfSingle(1, referrer.phone, cAmount, callback);
                            },
                            // coins in total record
                            (callback) => Prop.updateN('D', cAmount, callback),
                            // get 4th referrer
                            (_, callback) => User.getValues(referrer.phone, 'referrer', callback),
                            (doc, callback) => {
                                if (doc != null) {
                                    // if (doc.referrer == {}) callback('D');
                                    if (Object.keys(doc.referrer).length === 0) callback('D');
                                    else {
                                        referrer = doc.referrer;
                                        callback(null);
                                    }
                                }
                                else callback('Error processing commission');
                            },
                            // give 5% commision to 4th referrer
                            (callback) => {
                                cAmount = functions.getPercentAmount(amount * values.coinRate, values.rechargeCommisions[3]);
                                User.updateCoinsOfSingle(1, referrer.phone, cAmount, callback);
                            },
                            // coins in total record
                            (callback) => Prop.updateN('D', cAmount, callback),
                            // get 5th referrer
                            (_, callback) => User.getValues(referrer.phone, 'referrer', callback),
                            (doc, callback) => {
                                if (doc != null) {
                                    if (Object.keys(doc.referrer).length === 0) callback('D');
                                    else {
                                        referrer = doc.referrer;
                                        callback(null);
                                    }
                                }
                                else callback('Error processing commission');
                            },
                            // give 5% commision to 5th referrer
                            (callback) => {
                                cAmount = functions.getPercentAmount(amount * values.coinRate, values.rechargeCommisions[4]);
                                User.updateCoinsOfSingle(1, referrer.phone, cAmount, callback);
                            },
                            // coins in total record
                            (callback) => Prop.updateN('D', cAmount, callback),
                        ], (err) => {
                            if (err && err != 'D') callback(err);
                            else callback(null);
                        });
                    } else { // all users
                        callback(null);
                    }
                } else {
                    callback(null);
                }
            },
            (callback) => {
                if (rType == 0) {
                    User.countDocuments({ role: 2 }, (err, count) => {
                        if (err) callback('Error updating data');
                        else Prop.updateN(cType == 0 ? 'V' : 'D', amount * values.coinRate * count, callback);
                    });
                }

                else Prop.updateN(cType == 0 ? 'V' : 'D', amount * values.coinRate, callback);
            }
        ], (err) => {
            if (err) return res.json({ success: false, error: err });

            return res.json({ success: true, trx });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// get special users
router.get('/special-users/:page', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        
        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        let page = req.params.page;
        if (page == undefined || isNaN(page)) page = 0;

        User.getSpecial(page, (err, docs) => {
            if (err) return res.json({ success: false, error: 'Bad Request' });
            return res.json({ success: true, docs });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// update special user status
router.get('/special-update/:action/:phone', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        
        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        const action = req.params.action;
        if (action == undefined || (action != 'a' && action != 'r')) return res.json({ success: false, error: 'Bad Request' });
        
        const phone = req.params.phone;
        if (phone == undefined || !functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: functions.isValidPhoneNumber(phone).error });
        
        User.updateSpecial(phone, action == 'a', (err) => {
            if (err) return res.json({ success: false, error: err });

            return res.json({ success: true });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// get agents
router.get('/agents/:page', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        
        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        let page = req.params.page;
        if (page == undefined || isNaN(page)) page = 0;

        User.getAgents(page, (err, docs) => {
            if (err) return res.json({ success: false, error: 'Bad Request' });
            return res.json({ success: true, docs });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// update agent status
router.get('/agent-update/:action/:phone', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;
        
        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        const action = req.params.action;
        if (action == undefined || (action != 'a' && action != 'r')) return res.json({ success: false, error: 'Bad Request' });
        
        const phone = req.params.phone;
        if (phone == undefined || !functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: functions.isValidPhoneNumber(phone).error });
        
        User.updateAgent(phone, action == 'a', (err) => {
            if (err) return res.json({ success: false, error: err });

            return res.json({ success: true });
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

// get coins generated so far
router.get('/props', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (aUser.role != 0) return res.json({ success: false, error: 'Bad Request' });

        Prop.getMultiple(['D', 'V'], (err, docs) => {
            if (err) return res.json({ success: false, error: 'Error' });
            
            else {
                let props = { coins: 0, diamonds: 0 };
                for (let y = 0; y < docs.length; y++) {
                    if (docs[y].key == 'D') props.diamonds = docs[y].n;
                    else if (docs[y].key == 'V') props.coins = docs[y].n;
                }
                
                return res.json({ success: true, props });
            }
        });
    } catch (e) {
        console.log(e);
        return res.json({ success: false, error: 'Bad Request' });
    }
});

module.exports = router;