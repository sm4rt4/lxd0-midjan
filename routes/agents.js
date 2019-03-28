const express = require('express');
const router = express.Router();
const passport = require('passport');
const async = require('async');
const User = require('../models/user');
const Prop = require('../models/prop');
const Trx = require('../models/transaction');
const functions = require('../includes/functions');
const values = require('../includes/values');

// User recharge
router.post('/recharge', passport.authenticate('jwt', { session: false }), (req, res) => {
    try {
        const aUser = req.user;

        if (!aUser.agent) return res.json({ success: false, error: 'Bad Request' });

        const phone = req.body.phone.trim();
        const amount = req.body.amount;
        const rType = 1;
        const cType = 1;
        
        if (phone == undefined || amount == undefined) return res.json({ success: false, error: 'Bad Request' });

        if (rType == 1 && !functions.isValidPhoneNumber(phone).success) return res.json({ success: false, error: functions.isValidPhoneNumber(phone).error });

        if (isNaN(amount) || amount < 1) return res.json({ success: false, error: 'Amount invalid' });

        if (aUser.sc < amount * values.coinRate) return res.json({ success: false, error: 'Not Enough Balance' });
        
        const trxData = { sender: aUser.phone, receiver: phone, amount, type: 1 };

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
                // if (referrer != '-' && cType == 1) {
                if (cType == 1) {
                    if (rType == 1 && Object.keys(referrer).length > 0) { // single user
                        let cAmount = functions.getPercentAmount(amount * values.coinRate, values.rechargeCommisions[0]);
                        
                        async.waterfall([
                            // give 20% commission to 1st referrer
                            (callback) => User.updateCoinsOfSingle(1, referrer.phone, cAmount, callback),
                            // get 2nd referrer
                            (callback) => User.getValues(referrer.phone, 'referrer', callback),
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
                                // cAmount = functions.getPercentAmount(amount * values.coinRate, 5);
                                User.updateCoinsOfSingle(1, referrer.phone, cAmount, callback);
                            },
                            // get 3rd referrer
                            (callback) => User.getValues(referrer.phone, 'referrer', callback),
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
                            // give 5% commision to 3rd referrer
                            (callback) => {
                                cAmount = functions.getPercentAmount(amount * values.coinRate, values.rechargeCommisions[2]);
                                User.updateCoinsOfSingle(1, referrer.phone, cAmount, callback);
                            },
                            // get 4th referrer
                            (callback) => User.getValues(referrer.phone, 'referrer', callback),
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
                            // give 5% commision to 4th referrer
                            (callback) => {
                                cAmount = functions.getPercentAmount(amount * values.coinRate, values.rechargeCommisions[3]);
                                User.updateCoinsOfSingle(1, referrer.phone, cAmount, callback);
                            },
                            // get 5th referrer
                            (callback) => User.getValues(referrer.phone, 'referrer', callback),
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
            (callback) => User.updateSpecialCoins(aUser.phone, -amount * values.coinRate, callback),
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

module.exports = router;