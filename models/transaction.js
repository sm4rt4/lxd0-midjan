const mongoose = require('mongoose');

// Types
// 0 > Agent Sale
// 1 > User Recharge
// 2 > Recharge Commision
// 3 > Self Recharge by Agent
// 4 >> Withdrawal Request
// 5 >> Payment made
// 7 >> Agent Recharge

// Status
// 0 > Pending
// 1 > Completed
// 2 > Cancelled

const Schema = mongoose.Schema({
    sender: {
        type: String,
        required: true
    },
    receiver: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: Number,
        default: 0
    },
    status: {
        type: Number,
        default: 1
    },
    time: {
        type: Date,
        default: Date.now
    }
});

const Transaction = module.exports = mongoose.model('Transaction', Schema);

// new transaction
module.exports.add = (trxData, callback) => {
    const newTrx = new Transaction(trxData);
    newTrx.save(callback);
}

// get transaction by id
module.exports.get = (_id, callback) => Transaction.findOne({ _id }, callback);

// get transactions
module.exports.getArray = (ids, callback) => Transaction.find({ _id: { $in: ids } }).sort({ 'time': -1 }).limit(100).exec(callback);
module.exports.getTypeArray = (ids, type, callback) => Transaction.find({ _id: { $in: ids }, type }).sort({ 'time': -1 }).limit(100).exec(callback);

// get transactions
module.exports.getMultiple = (page, callback) => Transaction.find().sort({ 'time': -1 }).skip(page * 50).limit(50).exec(callback);

// get latest
module.exports.getLatest = (callback) => Transaction.find().sort({ 'time': -1 }).limit(20).exec(callback);

// get transactions by status
module.exports.getByStatus = (status, page, callback) => Transaction.find({ status }).sort({ 'time': -1 }).skip(page * 50).limit(50).exec(callback);

// get transactions by type
module.exports.getByType = (type, page, callback) => Transaction.find({ type }).sort({ 'time': -1 }).skip(page * 50).limit(50).exec(callback);

// recharge transactions
module.exports.rechargeTransactions = (page, callback) => Transaction.find({ type: { $in: [0, 1, 6, 7] } }).sort({ 'time': -1 }).skip(page * 50).limit(50).exec(callback);
module.exports.agentRechargeTransactions = (u, page, callback) => Transaction.find({ type: 1, sender: u }).sort({ 'time': -1 }).skip(page * 50).limit(50).exec(callback);

//agentRechargeTransactions
// update transaction status
module.exports.update = (_id, status, callback) => Transaction.updateOne({ _id }, { status }, (err, result) => {
    if (err || result.nModified != 1) callback('Error updating transaction status');
    else callback(null);
});


// recent
module.exports.getRecent = (ids, callback) => Transaction.find({ _id: { $in: ids } }).sort({ 'time': -1 }).limit(20).exec(callback);