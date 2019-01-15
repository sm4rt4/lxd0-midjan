const mongoose = require('mongoose');

const Schema = ({
    players: {
        type: Array,
        required: []
    },
    completed: {
        type: Boolean,
        default: false
    },
    bet: {
        type: Number,
        required: true
    },
    winner: {
        type: Number,
        default: -1
    },
    time: {
        type: Date,
        default: Date.now
    },
    phone: {
        type: String,
        required: true
    }
});

const LocalGame = module.exports = mongoose.model('LocalGame', Schema);

// new game
module.exports.add = (gameData, callback) => {
    const newGame = new LocalGame(gameData);
    newGame.save(callback);
}

// verify owner
module.exports.verifyOwner = (_id, phone, callback) => {
    LocalGame.countDocuments({ _id, phone }, (err, count) => {
        if (err || count != 1) callback('Bad Request');
        callback(null);
    });
}

// on complete
module.exports.complete = (_id, winner, callback) => LocalGame.updateOne({ _id }, { winner, completed: true }, (err, result) => {
    if (err || result.nModified != 1) callback('Error updating game data');
    else callback(null);
});

// get game by id
module.exports.get = (_id, callback) => LocalGame.findOne({ _id }, callback);

// get lastest games
module.exports.getMultiple = (page, callback) => LocalGame.find().sort({ 'time': -1 }).skip(page * 50).limit(50).exec(callback);

// array
module.exports.getArray = (ids, callback) => LocalGame.find({ _id: { $in: ids } }).sort({ 'time': -1 }).limit(50).exec(callback);