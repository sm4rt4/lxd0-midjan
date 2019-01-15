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
        type: String,
        default: ''
    },
    time: {
        type: Date,
        default: Date.now
    }
});

const Game = module.exports = mongoose.model('Game', Schema);

// new game
module.exports.add = (gameData, callback) => {
    const newGame = new Game(gameData);
    newGame.save(callback);
}

// on complete
module.exports.complete = (_id, winner, callback) => Game.updateOne({ _id }, { winner, completed: true }, (err, result) => {
    if (err || result.nModified != 1) callback('Error updating game data');
    else callback(null);
});

// get game by id
module.exports.get = (_id, callback) => Game.findOne({ _id }, callback);

// get lastest games
module.exports.getMultiple = (page, callback) => Game.find().sort({ 'time': -1 }).skip(page * 50).limit(50).exec(callback);

// get games
module.exports.getArray = (ids, callback) => Game.find({ _id: { $in: ids } }).sort({ 'time': -1 }).limit(50).exec(callback);

// get latest
module.exports.getLatest = (callback) => Game.find().sort({ 'time': -1 }).limit(20).exec(callback);


// recent
module.exports.getRecent = (ids, callback) => Game.find({ _id: { $in: ids } }).sort({ 'time': -1 }).limit(20).exec(callback);