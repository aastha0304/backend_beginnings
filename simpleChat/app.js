var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	mongoose = require('mongoose'),
	redis = require('redis'),
	users = {};

server.listen(3000);

//var redis_client = redis.createClient('6379','10.1.2.195');
var redis_client = redis.createClient();
redis_client.get("chat_users", function(err, reply){
  if(reply){
      users = JSON.parse(reply);
  }
});

//mongoose.connect('mongodb://10.1.2.195:27017/chat', function(err){
//	if(err){
//		console.log(err);
//	} else{
//		console.log('Connected to mongodb!');
//	}
//});

mongoose.connect('mongodb://localhost/chat', function(err){
	if(err){
		console.log(err);
	} else{
		console.log('Connected to mongodb!');
	}
});

var chatSchema = mongoose.Schema({
	nick: String,
	msg: String,
	to: String,
	created: {type: Date, default: Date.now}
});

var Chat = mongoose.model('Message', chatSchema);

app.get('/', function(req, res){
	res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket){
	socket.on('new user', function(data, callback){
	    var query = Chat.find({$or:[{'to': 'all'}, {'to': data}]});
            query.sort('-created').limit(10).exec(function(err, docs){
                if(err) throw err;
                socket.emit('load old msgs', docs);
                docs.forEach( function (doc) {
                    if(doc.to==data)
                        doc.remove();
                });
            });
		if (data in users){
			callback(false);

		} else{
			callback(true);
			socket.nickname = data;
			users[socket.nickname] = socket;
			redis_client.hset('chat_users', socket.nickname, socket);
			updateNicknames();
		}
	});
	
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
				    var newMsg = new Chat({msg: msg, nick: socket.nickname, to: name});
                    newMsg.save(function(err){
                        if(err) throw err;
                        users[name].emit('new message', {msg: msg, nick: socket.nickname});
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
			var newMsg = new Chat({msg: msg, nick: socket.nickname, to: 'all'});
			newMsg.save(function(err){
				if(err) throw err;
				io.sockets.emit('new message', {msg: msg, nick: socket.nickname});
			});
		}
	});
	
	socket.on('disconnect', function(data){
	    console.log("called for "+socket.nickname)
		if(!socket.nickname) return;
		delete users[socket.nickname];
		redis_client.hdel('chat_users', socket.nickname);
		updateNicknames();
	});
});