const mongoose = require('mongoose');

const Schema = mongoose.Schema({
    key: {
        type: String,
        required: true
    },
    s: {
        type: String
    },
    n: {
        type: Number
    }
});

const Prop = module.exports = mongoose.model('Prop', Schema);

module.exports.setS = (key, s, callback) => Prop.updateOne({ key }, { s }, { upsert: true }, callback);

module.exports.setN = (key, n, callback) => Prop.updateOne({ key }, { n }, { upsert: true }, callback);

module.exports.updateN = (key, n, callback) => Prop.updateOne({ key }, { $inc: { n } }, { upsert: true }, callback);

module.exports.getMultiple = (keys, callback) => Prop.find({ key: { $in: keys } }, callback);

module.exports.get = (key, callback) => Prop.findOne({ key }, callback);