const DiscordStrategy = require('passport-discord').Strategy;
const passport = require('passport');
const config = require('../../config/config');

passport.use(new DiscordStrategy({
    clientID: config.clientID,
    clientSecret: config.clientSecret,
    callbackURL: config.clientRedirect,
    scope: ['identify', 'guilds']
}, (accessToken, refreshToken, profile, done) => {
    console.log(profile.username);
    console.log(profile.id);
}));