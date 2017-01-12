This is a chat server that : 
1. Creates a single chat room environment.
2. Connects all people in that room. 
3. People can send private messages to each other. 
4. People once logged in and reading their messages don't see ther private messages again 
5. Messages for entire room are stored even after being read, they will be deleted by TTL
6. All users and their socket in one chat session (sesion meaning while servers are run) are shared across by redis
7. All messages are stored in mongodb with sender, receiver, date and content

To run it, we need one system with redis server and mongodb installed, and others with mongo and redis clients.

It can be run with 'node app.js' on the servers, and connected to that server on 3000 port number.


