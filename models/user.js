const mongoose = require('mongoose');
const values = require('../includes/values');
const moment = require('moment');

// User roles
// 0 > Admin
// 2 >> User

// Coins >> Used to Play Games
// Chips >> Used to Recharge Coins
// Virtual coins added too

const Schema = mongoose.Schema({
    ads: { // address > state
        type: String,
        required: true
    },
    adc: { // address > city
        type: String,
        required: true
    },
    s: { // socket id
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: Number,
        default: 2
    },
    coins: {
        type: Number,
        default: 0
    },
    virt: {
        type: Number,
        default: 500
    },
    sc: { // special coins
        type: Number,
        default: 0
    },
    due: {
        type: Number,
        default: 0
    },
    games: {
        type: Array,
        default: []
    },
    localGames: {
        type: Array,
        default: []
    },
    friends: {
        type: Array,
        default: []
    },
    trx: {
        type: Array,
        default: []
    },
    blocked: {
        type: Boolean,
        default: false
    },
    special: {
        type: Boolean,
        default: false
    },
    agent: {
        type: Boolean,
        default: false
    },
    joined: {
        type: Date,
        default: Date.now
    },
    rewarded: {
        type: Date,
        default: Date.now
    },
    referrer: {
        type: Object,
        default: {}
    },
    under: {
        type: Array,
        default: []
    },
    gw: {
        type: Number,
        default: 0
    },
    myr: { // my refer code
        type: String,
        required: true
    },
    ldr: { // last diamonds recharge
        type: Object,
        default: {}
    }
}, { minimize: false });

const User = module.exports = mongoose.model('User', Schema);

module.exports.findByS = (s, callback) => User.findOne({ s }, callback);

module.exports.getUserById = (id, callback) => User.findById(id, callback);

module.exports.getAuthUser = (_id, password, callback) => User.findOne({ _id, password, blocked: false }, callback);

// module.exports.getUserOnLogin = (u, password, callback) => User.findOne({ u, password }, callback);

module.exports.getUser = (phone, callback) => User.findOne({ phone, blocked: false }, callback);

module.exports.userExists = (byUsername, value, callback) => {
    const query = byUsername ? { u: value } : { phone: value };

    User.findOne(query, (err, doc) => {
        if (err) {
            callback('Unknown Error');
            return;
        }

        callback(null, doc !== null);
    });
}

module.exports.userWithRefExists = (myr, callback) => {
    User.findOne({ myr }, (err, doc) => {
        if (err) {
            callback('Unknown Error');
            return;
        }

        callback(null, doc !== null);
    });
}

module.exports.userWithRef = (myr, callback) => {
    User.findOne({ myr }, callback);
}

module.exports.adminExists = (callback) => {
    User.findOne({ role: 0 }, (err, doc) => {
        if (err) {
            callback('Unknown Error');
            return;
        }

        callback(null, doc !== null);
    });
}

module.exports.addUser = (userData, callback) => {
    const newUser = new User(userData);
    newUser.save(callback);
}

// get users
module.exports.getUsers = (role, page, callback) => User.find({ role }).sort({ 'due': -1 }).skip(page * 50).limit(50).exec(callback);

// get special users
module.exports.getSpecial = (page, callback) => User.find({ special: true }).sort({ 'username': 1 }).skip(page * 50).limit(50).exec(callback);

// update special status
module.exports.updateSpecial = (phone, special, callback) => User.updateOne({ phone }, { $set: { special } }, (err, result) => {
    if (err || result.nModified != 1) callback('Error updating user status');
    else callback(null);
});

// get agents
module.exports.getAgents = (page, callback) => User.find({ agent: true }).sort({ 'username': 1 }).skip(page * 50).limit(50).exec(callback);

// update agent status
module.exports.updateAgent = (phone, agent, callback) => User.updateOne({ phone }, { $set: { agent } }, (err, result) => {
    if (err || result.nModified != 1) callback('Error updating user status');
    else callback(null);
});

// update balance
module.exports.updateCoins = (phone, amount, callback) => User.updateOne({ phone }, { $inc: { coins: amount } }, (err, result) => {
    if (err || result.nModified != 1) callback('Error updating balance');
    else callback(null);
});

// update games won
module.exports.updateGw = (phone, callback) => User.updateOne({ phone }, { $inc: { gw: 1 } }, (err, result) => {
    if (err || result.nModified != 1) callback('Error updating balance');
    else callback(null);
});

// update special coins of agent
module.exports.updateSpecialCoins = (phone, amount, callback) => {
    User.updateOne({ phone }, { $inc: { sc: amount } }, (err, result) => {
        if (err || result.nModified != 1) callback('Error updating coins');
        else callback(null);
    });
}

// update coins of single player
module.exports.updateCoinsOfSingle = (cType, phone, amount, callback) => {
    const incQuery =  cType == 0 ? { virt: amount } : { coins: amount };
    
    // const yesterday = Date.now();
    // yesterday.setDate(yesterday.getDate() - 1);

    // const setQuery = cType == 0 ? {} : { ldr: { st: Date.now(), ti: yesterday, am: amount / values.coinRate } };

    User.updateOne({ phone }, { /*$set: setQuery,*/ $inc: incQuery }, (err, result) => {
        if (err || result.nModified != 1) callback('Error updating coins');
        else callback(null);
    });
}

// update coins of single player on RECHARGE
module.exports.updateCoinsOfSingleOnRecharge = (cType, phone, amount, callback) => {
    const incQuery =  cType == 0 ? { virt: amount } : { coins: amount };
    
    // const yesterday = Date.now();
    // yesterday.setDate(yesterday.getDate() - 1);

    const today = moment();
    const yesterday = moment(today).subtract(1, 'days');

    const setQuery = cType == 0 ? {} : { ldr: { st: today, ti: yesterday, am: amount / values.coinRate } };

    User.updateOne({ phone }, cType == 0 ? { $inc: incQuery } : { $set: setQuery, $inc: incQuery }, (err, result) => {
        if (err || result.nModified != 1) {
            console.log(`Err - ${err}`);
            callback('Error updating coins');
        }
        else callback(null);
    });
}

// update coins of all players
module.exports.updateCoinsOfAll = (cType, amount, callback) => {
    const incQuery =  cType == 0 ? { virt: amount } : { coins: amount };

    const today = moment();
    const yesterday = moment(today).subtract(1, 'days');

    const setQuery = cType == 0 ? {} : { ldr: { st: Date.now(), ti: yesterday, am: amount / values.coinRate } };

    User.updateMany({ role: 2 }, cType == 0 ? { $inc: incQuery } : { $set: setQuery, $inc: incQuery }, (err, result) => {
        if (err || result.ok != 1) callback('Error updating coins');
        else callback(null);
    });
}

// update due
module.exports.updateDue = (phone, amount, callback) => User.updateOne({ phone }, { $inc: { due: amount } }, (err, result) => {
    if (err || result.nModified != 1) callback('Error updating balance');
    else callback(null);
});

// has balance
module.exports.hasChips = (u, amount, callback) => User.findOne({ u }, (err, doc) => {
    if (err || doc == null) callback('Unknown Error');
    else callback(null, doc.chips >= amount);
});

// get value
module.exports.getValues = (phone, values, callback) => User.findOne({ phone }, values, callback);

// add transaction
module.exports.addTrx = (phone, trxId, callback) => User.updateOne({ phone }, { $push: { trx: trxId } }, (err, result) => {
    if (err || result.nModified != 1) callback('Error adding transaction');
    else callback(null);
});

// add under
// module.exports.updateUnder = (phone, underData, callback) => User.updateOne({ phone }, { $push: { under: underData } }, (err, result) => {
//     if (err || result.nModified != 1) callback('Error');
//     else callback(null);
// });

// add under
module.exports.updateUnder = (myr, underData, callback) => User.updateOne({ myr }, { $push: { under: underData } }, (err, result) => {
    if (err || result.nModified != 1) callback('Error');
    else callback(null);
});

// add transaction for all users
module.exports.addTrxForAll = (trxId, callback) => User.updateMany({ role: 2 }, { $push: { trx: trxId } }, (err, result) => {
    if (err || result.ok != 1) callback('Error adding transaction');
    else callback(null);
});

// get admin
module.exports.getAdmin = (callback) => {
    User.findOne({ role: 0 }, (err, doc) => {
        if (err || doc == null) callback('Unknown Error');
        else callback(null, doc.phone);
    });
}

// get latest data
module.exports.getLatest = (username, what, callback) => {
    User.findOne({ username }, what, (err, doc) => {
        if (err || doc == null) callback('Unknown Error');
        else callback(null, doc[what].slice(Math.max(doc[what].length - 5, 1)));
    });
}

// update password
module.exports.updatePassword = (phone, password, callback) => User.updateOne({ phone }, { password }, (err, result) => {
    if (err || result.nModified != 1) callback('Error updating password');
    else callback(null);
});

// get user transactions
module.exports.getUserTrx = (phone, callback) => User.findOne({ phone }, 'trx', callback);

// get user games
module.exports.getUserGames = (phone, callback) => User.findOne({ phone }, 'games', callback);

// get user local games
module.exports.getUserLocalGames = (phone, callback) => User.findOne({ phone }, 'localGames', callback);

// friends

module.exports.isFriend = (phone, f, callback) => {
    User.findOne({ phone }, 'friends', (err, doc) => {
        if (err || doc == null) callback('Error processing request');
        else {
            const friends = doc.friends;
            callback(null, friends.indexOf(f) >= 0);
        }
    });
}

module.exports.addFriend = (phone, f, callback) => User.updateOne({ phone }, { $push: { friends: f } }, (err, result) => {
    if (err || result.nModified != 1) callback('Error adding friend');
    else callback(null);
});

module.exports.remFriend = (phone, f, callback) => User.updateOne({ phone }, { $pull: { friends: f } }, (err, result) => {
    if (err || result.nModified != 1) callback('Error removing friend');
    else callback(null);
});

// friends

// add game
module.exports.addGame = (phone, gId, callback) => User.updateOne({ phone }, { $push: { games: gId } }, (err, result) => {
    if (err || result.nModified != 1) callback('Error updating games');
    else callback(null);
});

// add local game
module.exports.addLocalGame = (phone, gId, callback) => User.updateOne({ phone }, { $push: { localGames: gId } }, (err, result) => {
    if (err || result.nModified != 1) callback('Error updating games');
    else callback(null);
});

// get agents
module.exports.getBlocked = (page, callback) => User.find({ blocked: true }).sort({ 'username': 1 }).skip(page * 50).limit(50).exec(callback);

// update agent status
module.exports.updateBlocked = (phone, blocked, callback) => User.updateOne({ phone }, { $set: { blocked } }, (err, result) => {
    if (err || result.nModified != 1) callback('Error updating user status');
    else callback(null);
});