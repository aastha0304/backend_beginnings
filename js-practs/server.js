var express  = require('express');

var app      = express();
var port     = process.env.PORT || 3000;

var http     = require('http');
var socketio = require('socket.io')

var server   = http.createServer(app);
var io       = socketio.listen(server);

var passportSocketIo = require('passport.socketio');

var mongoose = require('mongoose');
var passport = require('passport');
var flash    = require('connect-flash');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');

var esession      = require('express-session');

var dbConfig = require('./config/database.js');
var users = {};

mongoose.connect(dbConfig.url);

var chatSchema = mongoose.Schema({
	nick: String,
	msg: String,
	to: String,
	created: {type: Date, default: Date.now}
});

var Chat = mongoose.model('Message', chatSchema);

app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs'); // set up ejs for templating

var store = new (require("connect-mongo")(esession))({
        url: dbConfig.url
    })
app.use(esession({
    key: "connect.sid",
    secret: "chatsecret",
    store: store
}));
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash());

require('./config/passport')(passport);
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
server.listen(3000, function() {
    console.log('App running on port: ' + port);
});

io.set('authorize', passportSocketIo.authorize({
    passport:     passport,
    cookieParser: cookieParser,
    key:          'connect.sid',
    secret:       'chatsecret',
    store:        store,
    success:      onAuthorizeSuccess,
    fail:         onAuthorizeFail
}));

function onAuthorizeSuccess(data, accept){
  console.log('successful connection to socket.io');
  accept(null, true);
}

function onAuthorizeFail(data, message, error, accept){
  if(error)
    throw new Error(message);
  console.log('failed connection to socket.io:', message);
  accept(null, false);
}

io.on('connection', function(socket) {
    var sessionStore = store;
    var sessionId    = socket.handshake.sessionId;

    sessionStore.get(sessionId, function(err, session) {
        if( ! err) {
            if(session.passport.user) {
                users[session.passport.user] = socket;
                console.log('This is the users email address %s', session.passport.user);
            }
            function updateNicknames(){
                io.sockets.emit('usernames', Object.keys(users));
            }
            socket.on('send message', function(data, callback){
                var msg = data.trim();
                console.log('after trimming message is: ' + msg);
                if(msg.substr(0,3) === '/w '){
                    msg = msg.substr(3);
                    var ind = msg.indexOf(' ');
                    if(ind !== -1){
                        var name = msg.substring(0, ind);
                        var msg = msg.substring(ind + 1);
                        if(name in users){
                            var newMsg = new Chat({msg: msg, nick: session.passport.user, to: name});
                            newMsg.save(function(err){
                                if(err) throw err;
                                users[name].emit('new message', {msg: msg, nick: session.passport.user});
                            });
                            console.log('message sent is: ' + msg);
                            console.log('Whisper!');
                        } else{
                            callback('Error!  Enter a valid user.');
                        }
                    } else{
                        callback('Error!  Please enter a message for your whisper.');
                    }
                } else{
                    var newMsg = new Chat({msg: msg, nick: session.passport.user, to: 'all'});
                    newMsg.save(function(err){
                        if(err) throw err;
                        io.sockets.emit('new message', {msg: msg, nick: session.passport.user});
                    });
                }
            });

            socket.on('disconnect', function(data){
                console.log("called for "+session.passport.user);
                if(!session.passport.user) return;
                delete users[session.passport.user];
                updateNicknames();
            });
        }
    });
});