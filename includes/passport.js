const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;
const User = require('../models/user');
const values = require('../includes/values');

module.exports = (passport) => {
    let opts = {};
    opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme('jwt');
    opts.secretOrKey = values.secret;

    passport.use(new JwtStrategy(opts, (jwt_payload, done) => {
        User.getAuthUser(jwt_payload.data._id, jwt_payload.data.password, (err, user) => {
            if (err) return done(err, false);            
            if (user) return done(null, user);
            else return done(null, false);
        });
    }));
};