const port = process.env.PORT || 3000;

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const values = require('./includes/values');
const functions = require('./includes/functions');
const passport = require('passport');
const async = require('async');
const User = require('./models/user');
const GameModel = require('./models/game');

mongoose.connect(values.databaseUrl, {
    useNewUrlParser: true
});

mongoose.connection.on('connected', () => {
    console.log(`Connected to database at ${values.databaseUrl}`);
});

mongoose.connection.on('error', (err) => {
    console.log(`Database Error: ${err}`);
});

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(passport.initialize());
app.use(passport.session());
require('./includes/passport')(passport);

const usersRoute = require('./routes/users');
const adminRoute = require('./routes/admin');
const agentsRoute = require('./routes/agents');

app.use('/users', usersRoute);
app.use('/admin', adminRoute);
app.use('/agents', agentsRoute);

app.get('/', (_, res) => {
    res.sendFile('Invalid Endpoint');
});

app.get('*', (_, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// socket.io

const http = require('http').Server(app);
const io = require('socket.io')(http);

const betKinds = [ 100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000, 50000000, 100000000, 50000000, 1000000000 ];
const botTurnWait = {
    min: 1,
    max: 2
};

io.on('connection', (socket) => {
    console.log('User Connected ' + socket.id);

    // set id
    socket.on('si', (uid) => {
        try {
            if (players[uid] != null) players[uid].socket.disconnect('unauthorized');

            async.waterfall([
                (callback) => User.findByS(uid, callback),
                (userDoc, callback) => {
                    try {
                        if (userDoc == null) callback('Bad Request');
                    
                        else {
                            sockets[socket.id] = {
                                id: uid,
                                phone: userDoc.phone
                            };
    
                            players[uid] = new Player(socket, userDoc.username, userDoc.phone);
                            
                            callback(null);
                        }
                    } catch (e) {
                        console.log(e);
                    }
                }
            ], (err) => {
                if (err) {
                    console.log(err);
                    socket.disconnect('unauthorized');
                }
            });
        } catch(e) {
            console.log(e);
        }
    });

    // online friends
    socket.on('mof', (friends) => {
        let onlineFriends = [];
        console.log('Friends - ' + friends);
        
        async.each(friends, (friend, callback) => {
            async.waterfall([
                (callback) => User.getValues(friend, 's', callback),
                (doc, callback) => {
                    if (doc == null || doc.s == undefined) callback('Error');
                    else {
                        console.log(players);
                        console.log(doc);
                        console.log(players[doc.s]);
                        
                        if (players[doc.s] != null && players[doc.s] != undefined) onlineFriends.push(friend);
                        callback(null);
                    }
                }
            ], (err) => {
                if (err) callback(err);
                else callback(null);
            });
        }, (err) => {
            if (err) console.log(err);
            else {
                socket.emit('mofl', onlineFriends);
            }
        });
    });

    // send game request
    // se = some error
    socket.on('sgr', (pCount, cType, bet) => {
        try {
            if (betKinds.indexOf(bet) < 0) {
                socket.emit('se', 'Invalid Bet Amount');
                return;
            }

            if (players[sockets[socket.id].id].game.index != -1 || players[sockets[socket.id].id].game.gameId != '') {
                socket.emit('se', 'Already Playing');                
                return;
            }

            async.waterfall([
                (callback) => User.getValues(sockets[socket.id].phone, 'coins virt special', callback),
                (userDoc, callback) => {
                    try {
                        if (userDoc == null) callback('Bad Request');

                        else if ((cType == 0 && bet > userDoc.virt) || (cType == 1 && bet > userDoc.coins)) {
                            callback('Not enough coins');
                        }

                        else {
                            const iAmSpecial = userDoc.special;

                            let gameFound = false;
                            let gameStarted = true;
                            let whichGame;

                            for (let i = 0; i < gameRequests.length; i++) {
                                if (gameRequests[i].open && gameRequests[i].pCount == pCount && gameRequests[i].cType == cType && gameRequests[i].bet == bet && gameRequests[i].players.indexOf(sockets[socket.id].id) < 0) {
                                    if (gameRequests[i].specialIndex != -1 && iAmSpecial) continue;                                    
                                    
                                    if (gameRequests[i].players.length == pCount) continue;

                                    gameFound = true;
                                    whichGame = i;

                                    gameRequests[i].players.push(sockets[socket.id].id);

                                    if (iAmSpecial) gameRequests[i].specialIndex = gameRequests[i].players.length - 1;

                                    socket.emit('gid', gameRequests[i].tempId);

                                    if (gameRequests[i].pCount == gameRequests[i].players.length) {
                                        if (pCount == 2) {
                                            const myColor = functions.getRandomNumber(0, 3);
                                            const oppColor = myColor < 2 ? myColor + 2 : myColor - 2;

                                            const myIndex = functions.getRandomNumber(0, 1);
                                            const oppIndex = myIndex == 0 ? 1 : 0;

                                            if (iAmSpecial) gameRequests[i].specialIndex = myIndex;
                                            else if (gameRequests[i].specialIndex != -1) gameRequests[i].specialIndex = oppIndex;

                                            const myData = {
                                                index: myIndex,
                                                color: myColor,
                                                username: players[sockets[socket.id].id].username,
                                                phone: players[sockets[socket.id].id].phone
                                            };
                                            const oppData = {
                                                index: oppIndex,
                                                color: oppColor,
                                                username: players[gameRequests[i].players[0]].username,
                                                phone: players[gameRequests[i].players[0]].phone
                                            };

                                            const playersData = [myData, oppData];

                                            socket.emit('gra', myIndex, playersData);
                                            players[gameRequests[i].players[1]].game.index = myIndex;

                                            players[gameRequests[i].players[0]].socket.emit('gra', oppIndex, playersData);
                                            players[gameRequests[i].players[0]].game.index = oppIndex;
                                        } else {
                                            let xIndex = functions.getRandomNumber(0, 3);
                                            let xColor = functions.getRandomNumber(0, 3);

                                            let playersData = [{
                                                index: xIndex,
                                                color: xColor
                                            }];

                                            for (let j = 0; j < 3; j++) {
                                                xIndex++;
                                                if (xIndex == 4) xIndex = 0;

                                                xColor++;
                                                if (xColor == 4) xColor = 0;

                                                playersData.push({
                                                    index: xIndex,
                                                    color: xColor
                                                });
                                            }

                                            for (let g = 0; g < gameRequests[i].players.length; g++) {
                                                for (let h = 0; h < playersData.length; h++) {
                                                    if (playersData[h].index == g) {
                                                        if (g == gameRequests[i].specialIndex) gameRequests[i].specialIndex = playersData[h].index;
                                                        playersData[h].username = players[gameRequests[i].players[g]].username;
                                                        playersData[h].phone = players[gameRequests[i].players[g]].phone;
                                                        break;
                                                    }
                                                }
                                            }

                                            for (let g = 0; g < gameRequests[i].players.length; g++) {
                                                players[gameRequests[i].players[g]].socket.emit('gra', g, playersData);
                                                players[gameRequests[i].players[g]].game.index = g;
                                            }
                                        }
                                    } else {
                                        gameStarted = false;
                                    }

                                    break;
                                }
                            }

                            if (!gameFound) {
                                const tempId = 't' + functions.getCurrentTime();
                                gameRequests.push({
                                    tempId,
                                    open: true,
                                    pCount,
                                    cType,
                                    bet,
                                    players: [sockets[socket.id].id],
                                    specialIndex: iAmSpecial ? 0 : -1
                                });
                                socket.emit('gid', tempId);

                                //
                                if (cType == 0 && bet >= 100 && bet <= 1000) {
                                    const ival = setInterval(() => {
                                        for (let index = 0; index < gameRequests.length; index++) {
                                            if (gameRequests[index].tempId == tempId) {
                                                if (gameRequests[index] != null && gameRequests[index].players.length == pCount - 1) {
                                                    clearInterval(ival);
        
                                                    const botS = createBot();
                                                    gameRequests[index].players.push(botS);
        
                                                    let botIndex;
                                                    
                                                    // 2 player game
                                                    if (pCount == 2) {
                                                        const myColor = functions.getRandomNumber(0, 3);
                                                        const oppColor = myColor < 2 ? myColor + 2 : myColor - 2;
            
                                                        const myIndex = functions.getRandomNumber(0, 1);
                                                        botIndex = myIndex;
                                                        const oppIndex = myIndex == 0 ? 1 : 0;
            
                                                        if (gameRequests[index].specialIndex != -1) gameRequests[index].specialIndex = oppIndex;
            
                                                        const myData = {
                                                            index: myIndex,
                                                            color: myColor,
                                                            username: players[gameRequests[index].players[1]].username,
                                                            phone: players[gameRequests[index].players[1]].phone,
                                                            bot: '' + functions.getRandomNumber(1, 9)
                                                        };
                                                        const oppData = {
                                                            index: oppIndex,
                                                            color: oppColor,
                                                            username: players[gameRequests[index].players[0]].username,
                                                            phone: players[gameRequests[index].players[0]].phone
                                                        };
            
                                                        const playersData = [myData, oppData];
            
                                                        // socket.emit('gra', myIndex, playersData);
                                                        players[gameRequests[index].players[1]].game.index = myIndex;
            
                                                        players[gameRequests[index].players[0]].socket.emit('gra', oppIndex, playersData);
                                                        players[gameRequests[index].players[0]].game.index = oppIndex;
                                                    } else {
                                                        let xIndex = functions.getRandomNumber(0, 3);
                                                        let xColor = functions.getRandomNumber(0, 3);
            
                                                        let playersData = [{
                                                            index: xIndex,
                                                            color: xColor
                                                        }];
            
                                                        for (let j = 0; j < 3; j++) {
                                                            xIndex++;
                                                            if (xIndex == 4) xIndex = 0;
            
                                                            xColor++;
                                                            if (xColor == 4) xColor = 0;
            
                                                            playersData.push({
                                                                index: xIndex,
                                                                color: xColor
                                                            });
                                                        }
            
                                                        for (let g = 0; g < gameRequests[index].players.length; g++) {
                                                            for (let h = 0; h < playersData.length; h++) {
                                                                if (playersData[h].index == g) {
                                                                    if (g == gameRequests[index].specialIndex) gameRequests[index].specialIndex = playersData[h].index;    
        
                                                                    if (isNaN(players[gameRequests[index].players[g]].phone)) {
                                                                        botIndex = playersData[h].index;
                                                                        playersData[h].bot = '' + functions.getRandomNumber(1, 9);
                                                                    }
                                                                    
                                                                    playersData[h].username = players[gameRequests[index].players[g]].username;
                                                                    playersData[h].phone = players[gameRequests[index].players[g]].phone;
                                                                    break;
                                                                }
                                                            }
                                                        }
            
                                                        for (let g = 0; g < gameRequests[index].players.length; g++) {
                                                            if (players[gameRequests[index].players[g]].socket != null) players[gameRequests[index].players[g]].socket.emit('gra', g, playersData);
                                                            players[gameRequests[index].players[g]].game.index = g;
                                                        }
                                                    }
        
                                                    const gameId = functions.getCurrentTime();
        
                                                    games[gameId] = new Game(gameRequests[index].players, pCount, cType, bet, gameRequests[index].specialIndex, botIndex, botS);
                                                    gameRequests.splice(index, 1);
        
                                                    for (let g = 0; g < games[gameId].players.length; g++) {
                                                        players[games[gameId].players[g]].game.gameId = gameId;
                                                    }
        
                                                    setStartTimer(gameId, 5000);
                                                }
                                            }
                                        }
                                    }, 6000);
                                }
                                //
                            } else if (gameFound && gameStarted) {
                                const gameId = functions.getCurrentTime();

                                games[gameId] = new Game(gameRequests[whichGame].players, pCount, cType, bet, gameRequests[whichGame].specialIndex, -1, '');
                                gameRequests.splice(whichGame, 1);

                                for (let g = 0; g < games[gameId].players.length; g++) {
                                    players[games[gameId].players[g]].game.gameId = gameId;
                                }

                                setStartTimer(gameId, 5000);
                            }

                            callback(null);
                        }
                    } catch (e) {
                        console.log(e);
                    }
                }
            ], (err) => {
                if (err) {
                    console.log(err);
                    socket.emit('se', err);
                }
            });
        } catch (e) {
            console.log(e);
        }

        console.log(gameRequests);
    });

    // game request from friend
    // sfgr = send friend game request
    // rfgr = received friend game request
    // fgri = friendly game request id
    socket.on('sfgr', (pCount, cType, bet, friends) => {
        console.log(`Game Request among Friends ${cType} - ${bet} - ${pCount} - ${friends}`);

        try {
            if (betKinds.indexOf(bet) < 0) {
                socket.emit('se', 'Invalid Bet Amount');
                return;
            }

            if (players[sockets[socket.id].id].game.index != -1 || players[sockets[socket.id].id].game.gameId != '') {
                socket.emit('se', 'Already Playing');                
                return;
            }

            // bet /= 1000;

            async.waterfall([
                (callback) => User.getValues(sockets[socket.id].phone, 'coins virt username special', callback),
                (userDoc, callback) => {
                    if (userDoc == null) callback('Bad Request');

                    else if ((cType == 0 && bet > userDoc.virt) || (cType == 1 && bet > userDoc.coins)) callback('Not Enough Balance');

                    else {
                        const iAmSpecial = userDoc.special;
                        let specialCount = iAmSpecial ? 1 : 0;
                        let specialIndex = iAmSpecial ? 0 : -1;

                        const tempId = functions.getCurrentTime();
                        console.log('```' + tempId);

                        let c = 1;

                        async.each(friends, (friend, callback) => {
                            User.getValues(friend, 's special', (err, friendDoc) => {
                                if (err) callback('Error sending game request');
                                else {
                                    try {
                                        console.log(friendDoc);

                                        console.log({
                                            from: userDoc.username,
                                            bet
                                        });

                                        if (friendDoc.special) {
                                            specialIndex = c;
                                            specialIndex++;
                                            
                                            specialCount++;
                                            if (specialCount > 1) callback('Invalid Request');
                                        }

                                        players[friendDoc.s].socket.emit('rfgr', {
                                            tempId,
                                            from: userDoc.username,
                                            bet,
                                            pCount,
                                            cType
                                        });

                                        callback(null);
                                    } catch (e) {
                                        console.log(e);
                                        callback('Unknown Error');
                                    }
                                }
                            });
                        }, (err) => {
                            if (err) callback(err);
                            else {
                                try {
                                    socket.emit('fgri', tempId);

                                    gameRequests.push({
                                        tempId,
                                        open: false,
                                        pCount,
                                        cType,
                                        bet,
                                        players: [sockets[socket.id].id],
                                        specialIndex: specialIndex
                                    });

                                    callback(null);
                                } catch (e) {
                                    console.log(e);
                                    callback('Unknown Error');
                                }
                            }
                        });
                    }
                }
            ], (err) => {
                if (err) {
                    console.log(err);
                    // socket.emit('se', err);
                }
            });
        } catch (e) {
            console.log(e);
        }
    });

    // friend game request accepted check coins
    socket.on('fgrx', (tempId) => {
        try {
            for (let p = 0; p < gameRequests.length; p++) {
                if (!gameRequests[p].open && gameRequests[p].tempId == tempId && gameRequests[p].players.indexOf(sockets[socket.id].id) < 0) {
                    const bet = gameRequests[p].bet;
                    const cType = gameRequests[p].cType;
                    const pCount = gameRequests[p].pCount;
                    
                    // const bet = gameRequests[p].bet / 1000;

                    User.getValues(sockets[socket.id].phone, 'coins virt special', (err, userDoc) => {
                        try {
                            if (!err && userDoc != null) {
                                if ((cType == 0 && bet > userDoc.virt) || (cType == 1 && bet > userDoc.coins)) {
                                    callback('Not enough coins');
                                } else {
                                    const iAmSpecial = userDoc.special;

                                    let gameFound = false;
                                    let gameStarted = true;
                                    let whichGame;

                                    for (let p = 0; p < gameRequests.length; p++) {
                                        if (!gameRequests[p].open && gameRequests[p].tempId == tempId && gameRequests[p].players.indexOf(sockets[socket.id].id) < 0) {
                                            const spRequest = gameRequests[p].specialIndex != -1 && !iAmSpecial;
                                            
                                            if (gameRequests[p].players.length == pCount) continue;
                                            
                                            gameFound = true;
                                            whichGame = p;

                                            gameRequests[p].players.push(sockets[socket.id].id);
                                            // socket.emit('fgri', tempId);

                                            if (gameRequests[p].players.length == pCount) {
                                                if (pCount == 2) {
                                                    const myColor = functions.getRandomNumber(0, 3);
                                                    const oppColor = myColor < 2 ? myColor + 2 : myColor - 2;

                                                    const myIndex = functions.getRandomNumber(0, 1);
                                                    const oppIndex = myIndex == 0 ? 1 : 0;

                                                    if (iAmSpecial) gameRequests[p].specialIndex = myIndex;
                                                    else if (spRequest) gameRequests[p].specialIndex = oppIndex;

                                                    const myData = {
                                                        index: myIndex,
                                                        color: myColor,
                                                        username: players[sockets[socket.id].id].username,
                                                        phone: players[sockets[socket.id].id].phone
                                                    };
                                                    const oppData = {
                                                        index: oppIndex,
                                                        color: oppColor,
                                                        username: players[gameRequests[p].players[0]].username,
                                                        phone: players[gameRequests[p].players[0]].phone
                                                    };
                                                    const playersData = [myData, oppData];

                                                    socket.emit('gra', myIndex, playersData);
                                                    players[gameRequests[p].players[1]].game.index = myIndex;

                                                    players[gameRequests[p].players[0]].socket.emit('gra', oppIndex, playersData);
                                                    players[gameRequests[p].players[0]].game.index = oppIndex;
                                                } else {
                                                    let xIndex = functions.getRandomNumber(0, 3);
                                                    let xColor = functions.getRandomNumber(0, 3);

                                                    let playersData = [{
                                                        index: xIndex,
                                                        color, xColor
                                                    }];

                                                    for (let j = 0; j < 3; j++) {
                                                        xIndex++;
                                                        if (xIndex == 4) xIndex = 0;

                                                        xColor++;
                                                        if (xColor == 4) xColor = 0;

                                                        playersData.push({
                                                            index: xIndex,
                                                            color: xColor
                                                        });
                                                    }

                                                    for (let g = 0; g < gameRequests[i].players.length; g++) {
                                                        for (let h = 0; h < playersData.length; h++) {
                                                            if (playersData[h].index == g) {
                                                                if (g == gameRequests[i].specialIndex) gameRequests[i].specialIndex = playersData[h].index;
                                                                playersData[h].username = players[gameRequests[i].players[g]].username;
                                                                playersData[h].phone = players[gameRequests[i].players[g]].phone;
                                                                break;
                                                            }
                                                        }
                                                    }

                                                    for (let g = 0; g < gameRequests[i].players.length; g++) {
                                                        players[gameRequests[i].players[g]].socket.emit('gra', g, playersData);
                                                        players[gameRequests[i].players[g]].game.index = g;
                                                    }
                                                }
                                            } else {
                                                gameStarted = false;
                                            }

                                            break;
                                        }
                                    }

                                    if (gameFound && gameStarted) {
                                        const gameId = functions.getCurrentTime();
                                        games[gameId] = new Game(gameRequests[whichGame].players, pCount, cType, bet, gameRequests[whichGame].specialIndex, -1, '');
                                        gameRequests.splice(whichGame, 1);

                                        for (let g = 0; g < games[gameId].players.length; g++) {
                                            players[games[gameId].players[g]].game.gameId = gameId;
                                        }

                                        setStartTimer(gameId, 5000);
                                    }
                                }
                            } else {
                                console.log('py3');
                                // socket.emit('fgrr', tempId);
                            }
                        } catch (e) {
                            console.log(e);
                        }
                    });

                    break;
                }
            }
        } catch (e) {
            console.log(e);
        }
    });

    // fgrr = friend game request rejected
    socket.on('fgrr', (tempId) => {
        try {
            for (let p = 0; p < gameRequests.length; p++) {
                if (gameRequests[p].open && gameRequests[p].tempId == tempId) {
                    for (let q = 0; q < gameRequests[p].players.length; q++) {
                        players[gameRequests[p].players[q]].socket.emit('fgrr', tempId);
                    }

                    gameRequests.splice(p, 1);
                    break;
                }
            }
        } catch (e) {
            console.log(e);
        }
    });

    // drr = dice roll request
    // dro = dice roll outcome
    // mt = move turn
    // pcm = player can't move
    socket.on('drr', () => {
        onDiceRoll(socket, '');
    });

    // mr = move request
    // mrc = move request completed
    // go = game over
    socket.on('mr', (pieceIndex) => {
        onMove(socket, '', pieceIndex);
    });

    // scm = send chat message
    // ncm = new chat message
    socket.on('scm', (msg) => {
        try {
            const gameId = players[sockets[socket.id].id].game.gameId;
            const myIndex = players[sockets[socket.id].id].game.index;

            for (let i = 0; i < games[gameId].players.length; i++) {
                if (players[games[gameId].players[i]].socket != null) players[games[gameId].players[i]].socket.emit('ncm', myIndex, msg);
            }
        }  catch (e) {
            console.log(e);
        }
    });

    // se = send emoji
    // ne = new emoji
    socket.on('se', (msg) => {
        try {
            const gameId = players[sockets[socket.id].id].game.gameId;
            const myIndex = players[sockets[socket.id].id].game.index;

            for (let i = 0; i < games[gameId].players.length; i++) {
                if (players[games[gameId].players[i]].socket != null) players[games[gameId].players[i]].socket.emit('ne', myIndex, msg);
            }
        }  catch (e) {
            console.log(e);
        }
    });

    // lgs = leave game search
    socket.on('lgs', (tempId) => {
        try {
            for (let i = 0; i < gameRequests.length; i++) {
                if (gameRequests[i].tempId == tempId) {
                    for (let j = 0; j < gameRequests[i].players.length; j++) {
                        // remove the player
                        if (gameRequests[i].players[j] == sockets[socket.id].id) {
                            gameRequests[i].players.splice(j, 1);

                            if (!gameRequests[i].open) {
                                for (let k = 0; k < gameRequests[i].players.length; k++) {
                                    if (players[gameRequests[i].players[q]].socket != null) players[gameRequests[i].players[q]].socket.emit('fgrr', tempId);
                                }
                            }

                            if (gameRequests[i].players.length == 0) gameRequests.splice(i, 1);

                            break;
                        }
                    }

                    break;
                }
            }

            console.log(gameRequests);
        } catch (e) {
            console.log(e);
        }
    });

     // lrg = leave running game
     socket.on('lrg', () => {
        try {
            const gameId = players[sockets[socket.id].id].game.gameId;

            for (let i = 0; i < games[gameId].players.length; i++) {
                if (games[gameId].players[i] == sockets[socket.id].id) {
                    // prrr
                    players[games[gameId].players[i]].game.index = -1;
                    players[games[gameId].players[i]].game.gameId = '';
                    // prrr

                    games[gameId].players.splice(i, 1);

                    if (games[gameId].players.length == 1) {
                        if (players[games[gameId].players[0]].socket != null) players[games[gameId].players[0]].socket.emit('gom', players[sockets[socket.id].id].username, games[gameId].prize());
                        games[gameId].end(players[games[gameId].players[0]].phone);
                    }

                    break;
                }
            }
        }  catch (e) {
            console.log(e);
        }
    });

    socket.on('disconnect', () => {
        try {
            // remove from searching games
            for (let i = 0; i < gameRequests.length; i++) {
                for (let j = 0; j < gameRequests[i].players.length; j++) {
                    if (gameRequests[i].players[j] == sockets[socket.id].id) {
                        socket.emit('lgs', gameRequests[i].tempId);
                    }
                }
            }
        } catch (e) {
            console.log(e);
        }

        try {
            // remove from games
            const gameId = players[sockets[socket.id].id].game.gameId;
            for (let i = 0; i < games[gameId].players.length; i++) {
                if (games[gameId].players[i] == sockets[socket.id].id) {
                    const tIndex = players[games[gameId].players[i]].game.index;

                    // prrr
                    players[games[gameId].players[i]].game.index = -1;
                    players[games[gameId].players[i]].game.gameId = '';
                    // prrr
                    
                    games[gameId].players.splice(i, 1);

                    if (games[gameId].players.length == 1) {
                        if (players[games[gameId].players[0]].socket != null) players[games[gameId].players[0]].socket.emit('gom', players[sockets[socket.id].id].username, games[gameId].prize());
                        games[gameId].end(players[games[gameId].players[0]].phone);
                    } else {
                        for (let j = 0; j < games[gameId].players.length; j++) {
                            if (games[gameId].players[j] != sockets[socket.id].id && players[games[gameId].players[j]].socket != null) {
                                players[games[gameId].players[j]].socket.emit('ppr', tIndex);
                            }
                        }
                    }

                    break;
                }
            }
        } catch (e) {
            console.log(e);
        }

        try {
            players[sockets[socket.id].id] = null;
            console.log('User disconnected ' + socket.id);
        } catch (e) {
            console.log(e);
        }
    });
});

// gs = game started
// dt = dice turn
function setStartTimer(gameId, t) {
    setTimeout(() => {
        try {
            games[gameId].turn = 0;
            games[gameId].rollAllowed = true;

            for (let g = 0; g < games[gameId].players.length; g++) {
                if (players[games[gameId].players[g]].socket != null) {
                    players[games[gameId].players[g]].socket.emit('gs');
                    players[games[gameId].players[g]].socket.emit('dt', 0);
                }
            }

            games[gameId].rollTimer = setRollTimer(gameId, 10000);
            if (games[gameId].botIndex == games[gameId].turn) {
                setTimeout(() => {
                    onDiceRoll(null, games[gameId].bid);
                }, 1000 * functions.getRandomNumber(botTurnWait.min, botTurnWait.max));
            }
        }  catch (e) {
            console.log(e);
        }
    }, t);
}

// dt = dice turn
function setRollTimer(gameId, t) {
    try {
        clearTimeout(games[gameId].rollTimer);

        if (games[gameId].turn == -1) return null;

        return setTimeout(() => {
            try {
                if (t != 0) {
                    console.log('ROLL Time up');

                    games[gameId].lives[games[gameId].turn]--;
                    if (games[gameId].lives[games[gameId].turn] == 0) {
                        console.log('Game Over for Player ' + games[gameId].turn);

                        games[gameId].out.push(games[gameId].turn);

                        console.log(`Players Out - ${games[gameId].out.length + (games[gameId].pCount - games[gameId].players.length)}`);

                        if (games[gameId].out.length + (games[gameId].pCount - games[gameId].players.length) == games[gameId].pCount - 1) {                        
                            let winnerIndex, winnerPhone;

                            for (let k = 0; k < games[gameId].players.length; k++) {
                                if (games[gameId].out.indexOf(players[games[gameId].players[k]].game.index) < 0) {
                                    winnerIndex = players[games[gameId].players[k]].game.index;
                                    winnerPhone = players[games[gameId].players[k]].phone;

                                    break;
                                }
                            }

                            for (let i = 0; i < games[gameId].players.length; i++) {
                                if (players[games[gameId].players[i]].socket != null) {
                                    players[games[gameId].players[i]].socket.emit('go', winnerIndex, games[gameId].prize());
                                }
                            }
                            
                            games[gameId].end(winnerPhone);

                            return null;
                        } else {
                            for (let g = 0; g < games[gameId].players.length; g++) {
                                try {
                                    if (players[games[gameId].players[g]].socket != null) players[games[gameId].players[g]].socket.emit('ppr', games[gameId].turn);
                                } catch (e) {
                                    console.log(e);
                                }
                            }
                        }

                        for (let i = 0; i < games[gameId].players.length; i++) {
                            if (players[games[gameId].players[i]].game.index == games[gameId].turn) {
                                // prrr
                                players[games[gameId].players[i]].game.index = -1;
                                players[games[gameId].players[i]].game.gameId = '';
                                // prrr
                            }
                        }
                    } else {
                        for (let g = 0; g < games[gameId].players.length; g++) {
                            try {
                                if (players[games[gameId].players[g]].socket != null) players[games[gameId].players[g]].socket.emit('plcu', games[gameId].turn, games[gameId].lives[games[gameId].turn]);
                            } catch (e) {
                                console.log(e);
                            }
                        }
                    }
                }

                let dn = false;
                while (!dn) {
                    games[gameId].turn++;
                    games[gameId].sixes = 0;
    
                    if (games[gameId].turn == games[gameId].pCount) games[gameId].turn = 0;

                    for (let g = 0; g < games[gameId].players.length; g++) {
                        if (games[gameId].out.indexOf(games[gameId].turn) < 0 && players[games[gameId].players[g]].game.gameId == gameId && players[games[gameId].players[g]].game.index == games[gameId].turn) {
                            dn = true;
                            break;
                        }
                    }

                    // if (games[gameId].out.indexOf(games[gameId].turn) < 0) dn = true;
                }

                games[gameId].rollAllowed = true;

                for (let g = 0; g < games[gameId].players.length; g++) {
                    try {
                        if (players[games[gameId].players[g]].socket != null) players[games[gameId].players[g]].socket.emit('dt', games[gameId].turn);
                    } catch (e) {
                        console.log(e);
                    }
                }

                games[gameId].rollTimer = setRollTimer(gameId, 10000);

                if (games[gameId].botIndex == games[gameId].turn) {
                    setTimeout(() => {
                        onDiceRoll(null, games[gameId].bid);
                    }, 1000 * functions.getRandomNumber(botTurnWait.min, botTurnWait.max));
                }
            }  catch (e) {
                console.log(e);
            }
        }, t);
    }  catch (e) {
        console.log(e);
    }
}

// dt = dice turn
function setMoveTimer(gameId, t) {
    try {
        clearTimeout(games[gameId].moveTimer);

        if (games[gameId].turn == -1) return null;

        try {
            return setTimeout(() => {
                //
                if (t != 0) {
                    console.log('MOVE Time up');

                    games[gameId].lives[games[gameId].turn]--;
                    if (games[gameId].lives[games[gameId].turn] == 0) {
                        console.log('Game Over for Player ' + games[gameId].turn);

                        games[gameId].out.push(games[gameId].turn);

                        console.log(`Players Out - ${games[gameId].out.length + (games[gameId].pCount - games[gameId].players.length)}`);

                        if (games[gameId].out.length + (games[gameId].pCount - games[gameId].players.length) == games[gameId].pCount - 1) {
                            let winnerIndex, winnerPhone;

                            for (let k = 0; k < games[gameId].players.length; k++) {
                                // if (games[gameId].out.indexOf(k) < 0) {
                                if (games[gameId].out.indexOf(players[games[gameId].players[k]].game.index) < 0) {                                
                                    winnerIndex = players[games[gameId].players[k]].game.index;
                                    winnerPhone = players[games[gameId].players[k]].phone;

                                    break;
                                }
                            }

                            for (let i = 0; i < games[gameId].players.length; i++) {
                                if (players[games[gameId].players[i]].socket != null) {
                                    players[games[gameId].players[i]].socket.emit('go', winnerIndex, games[gameId].prize());
                                }
                            }
                            
                            games[gameId].end(winnerPhone);

                            return null;
                        } else {
                            for (let g = 0; g < games[gameId].players.length; g++) {
                                try {
                                    if (players[games[gameId].players[g]].socket != null) players[games[gameId].players[g]].socket.emit('ppr', games[gameId].turn);
                                } catch (e) {
                                    console.log(e);
                                }
                            }
                        }

                        for (let i = 0; i < games[gameId].players.length; i++) {
                            if (players[games[gameId].players[i]].game.index == games[gameId].turn) {
                                // prrr
                                players[games[gameId].players[i]].game.index = -1;
                                players[games[gameId].players[i]].game.gameId = '';
                                // prrr
                            }
                        }
                    } else {
                        for (let g = 0; g < games[gameId].players.length; g++) {
                            try {
                                if (players[games[gameId].players[g]].socket != null) players[games[gameId].players[g]].socket.emit('plcu', games[gameId].turn, games[gameId].lives[games[gameId].turn]);
                            } catch (e) {
                                console.log(e);
                            }
                        }
                    }
                }
                //

                // let dn = false;
                // while (!dn) {
                //     games[gameId].turn++;
                //     games[gameId].sixes = 0;
    
                //     if (games[gameId].turn == games[gameId].pCount) games[gameId].turn = 0;

                //     if (games[gameId].out.indexOf(games[gameId].turn) < 0) dn = true;
                // }

                let dn = false;
                while (!dn) {
                    games[gameId].turn++;
                    games[gameId].sixes = 0;
    
                    if (games[gameId].turn == games[gameId].pCount) games[gameId].turn = 0;

                    for (let g = 0; g < games[gameId].players.length; g++) {
                        if (games[gameId].out.indexOf(games[gameId].turn) < 0 && players[games[gameId].players[g]].game.gameId == gameId && players[games[gameId].players[g]].game.index == games[gameId].turn) {
                            dn = true;
                            break;
                        }
                    }

                    // if (games[gameId].out.indexOf(games[gameId].turn) < 0) dn = true;
                }

                games[gameId].rollAllowed = true;

                for (let g = 0; g < games[gameId].players.length; g++) {
                    if (players[games[gameId].players[g]].socket != null) players[games[gameId].players[g]].socket.emit('dt', games[gameId].turn);
                }

                games[gameId].rollTimer = setRollTimer(gameId, 10000);
                
                if (games[gameId].botIndex == games[gameId].turn) {
                    setTimeout(() => {
                        onDiceRoll(null, games[gameId].bid);
                    }, 1000 * functions.getRandomNumber(botTurnWait.min, botTurnWait.max));
                }
            }, t);
        }  catch (e) {
            console.log(e);
        }
    }  catch (e) {
        console.log(e);
    }
}

// drr = dice roll request
// dro = dice roll outcome
// mt = move turn
// pcm = player can't move
function onDiceRoll(socket, bid) {
    try {
        const gameId = socket == null && bid != '' ? players[bid].game.gameId : players[sockets[socket.id].id].game.gameId;
        const myIndex = socket == null && bid != '' ? players[bid].game.index : players[sockets[socket.id].id].game.index;
        
        if (games[gameId].rollAllowed && games[gameId].turn == myIndex) {
            for (let i = 0; i < games[gameId].players.length; i++) {
                if (players[games[gameId].players[i]].socket != null) players[games[gameId].players[i]].socket.emit('drs');
            }

            games[gameId].rollAllowed = false;
            clearTimeout(games[gameId].rollTimer);

            setTimeout(() => {
                try {
                    let randomOutcome = functions.getRandomNumber(1, 6);

                    // special user
                    if (games[gameId].specialIndex != -1) {
                        console.log('special case');
                        
                        const iAmSpecial = myIndex == games[gameId].specialIndex;
                        console.log('special case' + iAmSpecial);


                        let yet_to_open = 0;
                        let very_close = 0;
                        let pDone = 0;

                        for (let i = 0; i < games[gameId].pieces[myIndex].length; i++) {
                            if (games[gameId].pieces[myIndex][i] == -1) yet_to_open++;
                            else if (games[gameId].pieces[myIndex][i] > 50) very_close++;
                            else if (games[gameId].pieces[myIndex][i] == -2) pDone++;
                        }

                        const exCase = functions.getRandomNumber(1, 7);
                        let appr = iAmSpecial ? [6, 6, 6, 1, 2, 3, 3, 4, 4, 5, 5, 1, 1, 3, 3, 6, 5, 1, 6, 4] : [1, 2, 3, 4, 4, 3, 2, 1, 5, 4, 5, 1, 2, 6];
                        if (exCase == 2) {
                            appr = iAmSpecial ? [1, 2, 2, 3, 4, 4, 5, 6, 1, 1] : [6, 6, 1, 2, 3, 4, 5, 2, 5, 6];
                        } else if (very_close > 1) {
                            appr = iAmSpecial ? [1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5, 1, 2, 5, 5, 6, 1] : [6, 5, 1, 2, 6, 6, 3, 4, 5, 5, 6, 6, 6, 5, 1];
                        } else if (yet_to_open > 2) {
                            console.log('TC');
                            appr = [6, 6, 6, 1, 2, 3, 4, 5, 3, 4, 6, 6];
                        }

                        if (!iAmSpecial && pDone == 3) {
                            appr = [1, 2, 3, 4, 5, 6];

                            for (let i = 0; i < games[gameId].pieces[myIndex].length; i++) {
                                if (games[gameId].pieces[myIndex][i] != -2) {
                                    const gap = 56 - games[gameId].pieces[myIndex][i];
                                    if (appr.indexOf(gap) >= 0) {
                                        appr.splice(appr.indexOf(gap), 1);
                                    }

                                    break;
                                }
                            }
                        }

                        randomOutcome = appr[functions.getRandomNumber(0, appr.length - 1)];
                    } else {
                        // ease in sixes
                        let yet_to_open = 0;

                        for (let i = 0; i < games[gameId].pieces[myIndex].length; i++) {
                            if (games[gameId].pieces[myIndex][i] == -1) yet_to_open++;
                        }

                        if (yet_to_open >= 3) {
                            console.log('Favor 6');
                            const appr = [6, 6, 6, 1, 2, 3, 4, 5, 3, 4, 6, 6];
                            randomOutcome = appr[functions.getRandomNumber(0, appr.length - 1)];
                        } else {
                            const appr = [6, 6, 1, 2, 3, 4, 5, 3, 4, 6, 4, 1];
                            randomOutcome = appr[functions.getRandomNumber(0, appr.length - 1)];
                        }
                        // ease in sixes
                    }

                    games[gameId].lastOutcome = randomOutcome;
                    if (randomOutcome == 6) games[gameId].sixes++;
                    else games[gameId].sixes = 0;

                    let canMove = false;
                    let movables = [];

                    if (randomOutcome == 6 && games[gameId].sixes == 3) {
                        canMove = false;
                    } else {
                        for (let i = 0; i < games[gameId].pieces[myIndex].length; i++) {
                            if (games[gameId].pieces[myIndex][i] == -1 && randomOutcome == 6) {
                                canMove = true;
                                movables.push(i);
                                // break;
                            } else if (games[gameId].pieces[myIndex][i] >= 0 && games[gameId].pieces[myIndex][i] + randomOutcome < 57) {
                                canMove = true;
                                movables.push(i);
                                // break;
                            }
                        }
                    }

                    for (let i = 0; i < games[gameId].players.length; i++) {
                        if (players[games[gameId].players[i]].socket != null) players[games[gameId].players[i]].socket.emit('dro', myIndex, randomOutcome);
                    }

                    if (canMove) {
                        for (let i = 0; i < games[gameId].players.length; i++) {
                            if (players[games[gameId].players[i]].socket != null) players[games[gameId].players[i]].socket.emit('mt', myIndex, movables);
                        }

                        games[gameId].moveTimer = setMoveTimer(gameId, 15000);
                        
                        if (games[gameId].botIndex == games[gameId].turn && movables.length > 0) {
                            setTimeout(() => {
                                onMove(null, games[gameId].bid, movables[functions.getRandomNumber(0, movables.length - 1)]);                                
                            }, 1000 * functions.getRandomNumber(botTurnWait.min, botTurnWait.max));
                        }
                    } else {
                        for (let i = 0; i < games[gameId].players.length; i++) {
                            if (players[games[gameId].players[i]].socket != null) players[games[gameId].players[i]].socket.emit('pcm', myIndex);
                        }

                        games[gameId].rollTimer = setRollTimer(gameId, 0);

                        if (games[gameId].botIndex == games[gameId].turn) {
                            setTimeout(() => {
                                onDiceRoll(null, games[gameId].bid);
                            }, 1000 * functions.getRandomNumber(botTurnWait.min, botTurnWait.max));
                        }
                    }
                }  catch (e) {
                    console.log(e);
                }
            }, 1000);
        }
    } catch (e) {
        console.log(e);
    }
}

// offsets
const offsets = [
    [0, -13, -26, -39],
    [-39, 0, -13, -26],
    [-26, -39, 0, -13],
    [-13, -26, -39, 0]
];
const lOffsets = [
    [0, 39, 26, 13],
    [13, 0, 39, 26],
    [26, 13, 0, 39],
    [39, 26, 13, 0]
];

// mr = move request
// mrc = move request completed
// go = game over
function onMove(socket, bid, pieceIndex) {
    try {
        const gameId = socket == null && bid != '' ? players[bid].game.gameId : players[sockets[socket.id].id].game.gameId;
        const myIndex = socket == null && bid != '' ? players[bid].game.index : players[sockets[socket.id].id].game.index;

        console.log(`Game Id - ${gameId} /// bid - ${bid}}`);
        
        if (!games[gameId].rollAllowed && games[gameId].turn == myIndex) {
            // if finished
            if (games[gameId].pieces[myIndex][pieceIndex] == -2) {
                return;
            }

            // if not opened yet
            else if (games[gameId].pieces[myIndex][pieceIndex] == -1) {
                // only move on 6
                if (games[gameId].lastOutcome == 6) {
                    games[gameId].pieces[myIndex][pieceIndex] = 0;

                    for (let i = 0; i < games[gameId].players.length; i++) {
                        if (players[games[gameId].players[i]].socket != null) {
                            players[games[gameId].players[i]].socket.emit('mrc', {
                                player: myIndex,
                                pieceIndex,
                                newPlace: games[gameId].pieces[myIndex][pieceIndex]
                            });
                            
                            players[games[gameId].players[i]].socket.emit('dt', myIndex);
                        }
                    }

                    clearTimeout(games[gameId].moveTimer);

                    games[gameId].rollAllowed = true;
                    games[gameId].rollTimer = setRollTimer(gameId, 10000);

                    if (games[gameId].botIndex == games[gameId].turn) {
                        setTimeout(() => {
                            onDiceRoll(null, games[gameId].bid);
                        }, 1000 * functions.getRandomNumber(botTurnWait.min, botTurnWait.max));
                    }
                }
            } else if (games[gameId].pieces[myIndex][pieceIndex] + games[gameId].lastOutcome <= 56) {
                games[gameId].pieces[myIndex][pieceIndex] += games[gameId].lastOutcome;

                // if finished
                if (games[gameId].pieces[myIndex][pieceIndex] == 56) {
                    games[gameId].pieces[myIndex][pieceIndex] = -2;
                    console.log("Player " + myIndex + "Piece " + pieceIndex + " finished");
                }

                for (let i = 0; i < games[gameId].players.length; i++) {
                    if (players[games[gameId].players[i]].socket != null) {
                        players[games[gameId].players[i]].socket.emit('mrc', {
                            player: myIndex,
                            pieceIndex,
                            newPlace: games[gameId].pieces[myIndex][pieceIndex]
                        });
                    }
                }

                clearTimeout(games[gameId].moveTimer);

                // if finished
                if (games[gameId].pieces[myIndex][pieceIndex] == -2) {
                    let comp = 0;
                    for (let i = 0; i < games[gameId].pieces[myIndex].length; i++) {
                        if (games[gameId].pieces[myIndex][i] == -2) comp++;
                    }

                    if (comp == 4) {
                        for (let i = 0; i < games[gameId].players.length; i++) {
                            if (players[games[gameId].players[i]].socket != null) {
                                players[games[gameId].players[i]].socket.emit('go', myIndex, games[gameId].prize());
                            }
                        }
                        games[gameId].end(players[sockets[socket.id].id].phone);
                        return;
                    }
                }
                // if finished

                let playerCut = -1;
                let cutPiece;
                const myPos = games[gameId].pieces[myIndex][pieceIndex];
                for (let b = 0; b < games[gameId].players.length; b++) {
                    if (players[games[gameId].players[b]].game.gameId != gameId) continue;

                    let tIndex = players[games[gameId].players[b]].game.index;

                    if (tIndex == -1 || tIndex == myIndex) continue;

                    let offset = 26;
                    let lOffset = 0;
                    if (games[gameId].pCount == 4) {
                        offset = offsets[myIndex][tIndex];
                        lOffset = lOffsets[myIndex][tIndex];
                    }
                    
                    // const offset = (myIndex - tIndex) * (games[gameId].players.length == 2 ? 26 : 13);
                    console.log(`Offset - ${offset}`);

                    let found = 0;
                    for (let c = 0; c < games[gameId].pieces[tIndex].length; c++) {
                        if (myPos > 50 || myPos < 0) continue;

                        let place = games[gameId].pieces[tIndex][c];
                        console.log(`Place - ${place}`);

                        if (place < 1 || place > 50 || place == 8 || place == 13 || place == 21 || place == 26 || place == 34 || place == 39 || place == 47) continue;

                        // place += offset;
                        // console.log(`Place after offset - ${place} /// ${myPos}`);

                        if (games[gameId].pCount == 4) {
                            if (place > lOffset) {
                                if (place - lOffset == myPos) {
                                    cutPiece = c;
                                    found++;
                                }
                            } else if (place - offset == myPos) {
                                cutPiece = c;
                                found++;
                            }
                        } else {
                            if (place - offset == myPos || place + offset == myPos) {
                                cutPiece = c;
                                found++;
                            }
                        }
                    }

                    if (found == 1) {
                        playerCut = tIndex;
                        break;
                    }
                }

                if (playerCut > -1) {
                    games[gameId].pieces[playerCut][cutPiece] = -1;

                    //
                    for (let i = 0; i < games[gameId].players.length; i++) {
                        // players[games[gameId].players[i]].socket.emit('pc', games[gameId].turn, playerCut, cutPiece);
                        if (players[games[gameId].players[i]].socket != null) {
                            players[games[gameId].players[i]].socket.emit('mrc', {
                                player: playerCut,
                                pieceIndex: cutPiece,
                                newPlace: -1,
                                w: games[gameId].lastOutcome
                            });
                        }
                    }
                    //
                }

                if (games[gameId].lastOutcome != 6 && games[gameId].pieces[myIndex][pieceIndex] != -2 && playerCut == -1) {
                    // let dn = false;
                    // while (!dn) {
                    //     games[gameId].turn++;
                    //     games[gameId].sixes = 0;
        
                    //     if (games[gameId].turn == games[gameId].pCount) games[gameId].turn = 0;

                    //     if (games[gameId].out.indexOf(games[gameId].turn) < 0) dn = true;
                    // }

                    let dn = false;
                    while (!dn) {
                        games[gameId].turn++;
                        games[gameId].sixes = 0;
        
                        if (games[gameId].turn == games[gameId].pCount) games[gameId].turn = 0;

                        for (let g = 0; g < games[gameId].players.length; g++) {
                            if (games[gameId].out.indexOf(games[gameId].turn) < 0 && players[games[gameId].players[g]].game.gameId == gameId && players[games[gameId].players[g]].game.index == games[gameId].turn) {
                                dn = true;
                                break;
                            }
                        }

                        // if (games[gameId].out.indexOf(games[gameId].turn) < 0) dn = true;
                    }
                }

                //
                setTimeout(() => {
                    for (let i = 0; i < games[gameId].players.length; i++) {
                        if (players[games[gameId].players[i]].socket != null) players[games[gameId].players[i]].socket.emit('dt', games[gameId].turn);
                    }

                    games[gameId].rollAllowed = true;
                    games[gameId].rollTimer = setRollTimer(gameId, 10000);

                    if (games[gameId].botIndex == games[gameId].turn) {
                        setTimeout(() => {
                            onDiceRoll(null, games[gameId].bid);
                        }, 1000 * functions.getRandomNumber(botTurnWait.min, botTurnWait.max));
                    }
                }, games[gameId].lastOutcome * 130);
                //
            }
        }
    } catch (e) {
        console.log(e);
    }
}

let players = {};
const botNames = ['Kajal', 'Karina', 'Ramesh', 'Muskan', 'Dolly', 'Rani', 'Raghav', 'Ram', 'Shyam', 'Saif', 'Hema', 'Jasleen', 'Jasmin', 'Kamna', 'Alia', 'Abida', 'Aisha', 'Aafreen', 'Aalia', 'Adnan', 'Atif', 'Misbah', 'Salman', 'Shahid', 'Zaheer', 'Zakir', 'Imran', 'Umer', 'Wasim', 'Khalid', 'Walid', 'Mohammad', 'Yasin', 'Yakub', 'Shama', 'Sarfraz', 'Sameer', 'Armaan', 'Abdul', 'Hafiz', 'Arbaaz', 'Asad', 'Anwar', 'Hakim', 'Raju', 'Prince', 'Bittu', 'Jay', 'Mansoor'];
function createBot() {
    const cTime = functions.getCurrentTime();
    
    const socketId = 'bs' + cTime;
    const uid = 'bi' + cTime;
    const phone = 'bp' + cTime;
    const username = botNames[functions.getRandomNumber(0, botNames.length - 1)];

    sockets[socketId] = {
        id: uid,
        phone
    };

    players[uid] = new Player(null, username, phone);
    
    return uid;
}

let sockets = {};
class Player {
    constructor(socket, username, phone) {
        this.socket = socket;
        this.username = username;
        this.phone = phone;
        this.game = {
            index: -1,
            gameId: ''
        };
    }
};

let games = {};
let gameRequests = [];
class Game {
    constructor(players, pCount, cType, bet, specialIndex, botIndex, bid) {
        this.players = players;
        this.pCount = pCount;
        this.cType = cType;
        this.bet = bet;

        this.turn = -1;
        this.lastOutcome = -1;
        this.rollAllowed = false;

        this.rollTimer;
        this.moveTimer;

        this.sixes = 0;

        this.pieces = [];
        for (let i = 0; i < pCount; i++) this.pieces.push([-1, -1, -1, -1]);

        this.lives = [3, 3, 3, 3];

        this.out = [];

        this.specialIndex = specialIndex;
        this.botIndex = botIndex;
        this.bid = bid;

        console.log(`Special ${specialIndex}`);

        // if (specialIndex != -1) console.log(`UnFair Game ${players[this.players[specialIndex]].username} shall win`);
        // else console.log('Fair Game');

        this.addToDb();
    }

    addToDb() {
        let phones = [];
        for (let p = 0; p < this.players.length; p++) phones.push(players[this.players[p]].phone);

        async.each(phones, (phone, callback) => {
            try {
                if (!isNaN(phone)) User.updateCoinsOfSingle(this.cType, phone, -this.bet, callback);
                else callback(null);
            } catch (e) {
                console.log(e);
            }
        }, (err) => {
            if (err) console.log(err);

            else {
                try {
                    GameModel.add({
                        players: phones,
                        bet: this.bet
                    }, (err, doc) => {
                        if (err || doc == null) {
                            console.log('Error adding game data');
                        } else {
                            this.dbId = doc._id;

                            async.each(phones, (phone, callback) => {
                                if (!isNaN(phone)) User.addGame(phone, this.dbId, callback);
                                else callback(null);
                            }, (err) => {
                                console.log(err);
                            });
                        }
                    });
                } catch (e) {
                    console.log(e);
                }
            }
        });
    }

    prize() {
        return this.bet * this.pCount * 0.9;
    }

    end(phone) {
        try {
            if (isNaN(phone)) {
                GameModel.complete(this.dbId, phone, (err) => {
                    if (err) console.log(err);
                });
            }

            else {
                User.updateCoinsOfSingle(this.cType, phone, this.prize(), (err) => {
                    if (err) console.log(err);

                    else {
                        User.updateGw(phone, (err) => {
                            if (err) console.log(err);

                            else {
                                GameModel.complete(this.dbId, phone, (err) => {
                                    if (err) console.log(err);
                                });
                            }
                        });
                    }
                });
            }

            this.turn = -1;
            this.players = [];
            clearTimeout(this.rollTimer);
            clearTimeout(this.moveTimer);
        } catch (e) {
            console.log(e);
        }
    }
};

// start express
http.listen(port, () => {
    console.log(`Server started on port ${port}`);
});