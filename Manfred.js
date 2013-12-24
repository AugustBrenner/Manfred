/*
The origional Socket interaction and bot set up was created by Neils Joubert
in his node-groupme github repository.  This program modifies his HelloBot
example.

Check him out at
https://github.com/njoubert
*/




/**
 * Module dependencies.
 */



var GroupMe             = require('groupme');
var API                 = require('groupme').Stateless;
var Processor           = require('./MessageProcessor');


/************************************************************************
 * Read the access token from the command line.
 ***********************************************************************/

// No command line arguments, we blow out. We need an access token.

if (process.argv.length < 3) {
    console.log("Usage: node Manfred.js ACCESS_TOKEN [user_id] [botname]");
    console.log("  Passing only ACCESS_TOKEN - returns user and group info");
    console.log("  Passing ACCESS_TOKEN, USER_ID, GROUP_ID, BOT_NAME - creates a new bot");
    console.log("  Passing ACCESS_TOKEN, USER_ID, BOT_ID - starts up the bot");
    process.exit(1);
} 
var ACCESS_TOKEN = process.argv[2];


/************************************************************************
 * Getting the bot configured and set up:
 ***********************************************************************/

if (process.argv.length == 3) {
    
    // Step 1: Only an access token, we request the user id

    API.Users.me(ACCESS_TOKEN, function(error,response) {
      if (!error) {
        console.log("Your user id is", response.id, "and your name is", response.name);        
      } else {
        console.log("ERROR!", error)
      }
    });  

    API.Bots.index(ACCESS_TOKEN, function(error,response) {
      if (!error) {
        console.log("Your bots are:")
        console.log(response);
      } else {
        console.log("ERROR!", error)
      }
    });

    API.Groups.index(ACCESS_TOKEN, function(error,response) {
      if (!error) {
        var names = [];
        for (var i = 0; i < response.length; i++) {
          names.push({"name":response[i].name, "id":response[i].id});
        }
        console.log("Your groups are:")
        console.log(names); 
        } else {
        console.log("ERROR!", error)
        }
    });

} else if (process.argv.length == 6) {

    // Step 2: Create a bot with the given name 

    var USER_ID  = process.argv[3];
    var GROUP_ID = process.argv[4];
    var BOT_NAME = process.argv[5];

    API.Bots.create(ACCESS_TOKEN, BOT_NAME, GROUP_ID, {}, function(error,response) {
        if (!error) {
            console.log(response);
        } else {
            console.log("Error creating bot!")
        }
    });

} else {

    // Step 3: Now we have a bot registered and we can start up.

    var USER_ID  = process.argv[3];
    var BOT_ID = process.argv[4];



    /************************************************************************
     * Set up the message-based IncomingStream and the HTTP push
     ***********************************************************************/

    var group_id = null;

    var retryCount = 3;

    // Constructs the IncomingStream, identified by the access token and 
    var incoming = new GroupMe.IncomingStream(ACCESS_TOKEN, USER_ID, null);

    /*
    // This logs the status of the IncomingStream
    incoming.on('status', function() {
        var args = Array.prototype.slice.call(arguments);
        var str = args.shift();
        console.log("[IncomingStream 'status']", str, args);
    });
    */
    

    // This waits for the IncomingStream to complete its handshake and start listening.
    // We then get the bot id of a specific bot.
    incoming.on('connected', function() {
        console.log("[IncomingStream 'connected']");

        API.Bots.index(ACCESS_TOKEN, function(error,response) {
            if (!error) {
                for (var i = 0; i < response.length; i++) {
                    if (response[i].bot_id == BOT_ID) {
                        group_id = response[i].group_id;
                    }
                }
                console.log("[API.Bots.index return] Firing up bot!", BOT_ID);
            }
        });

    });

    // This waits for messages coming in from the IncomingStream
    // If the message contains @BOT, we parrot the message back.
    incoming.on('message', function(message) {
        if(typeof message.data !== "undefined" && message != null){
            
            // Log Message.
            console.log("[IncomingStream 'message'] Message Received\n" + message.data.subject.text);

            // Process message.
            Processor.process(ACCESS_TOKEN, BOT_ID, group_id, message);
        }

    });

    // This listens for the bot to disconnect
    incoming.on('disconnected', function() {
        console.log("[IncomingStream 'disconnect']");
        if (retryCount > 3) {
            retryCount = retryCount - 1;
            incoming.connect();    
        }
    })

    // This listens for an error to occur on the Websockets IncomingStream.
    incoming.on('error', function() {
        var args = Array.prototype.slice.call(arguments);
        console.log("[IncomingStream 'error']", args);
        if (retryCount > 3) {
            retryCount = retryCount - 1;
            incoming.connect();    
        }
    })


    // This starts the connection process for the IncomingStream
    incoming.connect();
    
    // Refresh Stream
    setInterval(function() {
        // This starts the connection process for the IncomingStream
        incoming.disconnect();
        incoming.connect();
    }, 5 * 60 * 1000);
    

}
