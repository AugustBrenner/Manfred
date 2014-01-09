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
var Schedule            = require('node-schedule');
var Admin               = require('./index');
var Processor           = require('./MessageProcessor');
var StaleUsers          = Admin.StaleUsers;
var Membership          = Admin.MembershipUtilities;
var History             = Admin.HistoryUtilities;


/************************************************************************
 * Read the access token from the command line.
 ***********************************************************************/

// No command line arguments, we blow out. We need an access token.

if (process.argv.length < 3) {
    console.log("Usage: node Manfred.js ACCESS_TOKEN [user_id] [botname]");
    console.log("  Passing only ACCESS_TOKEN - returns user and group info");
    console.log("  Passing ACCESS_TOKEN, USER_ID, GROUP_ID, BOT_NAME - creates a new bot");
    console.log("  Passing ACCESS_TOKEN, USER_ID, BOT_ID, FROM_GROUP, TO_GROUP, DATABASE_URL - starts up the bot");
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

} else {

    // Step 3: Now we have a bot registered and we can start up.

    var USER_ID  = process.argv[3];
    var BOT_ID = process.argv[4];
    var FROM_GROUP = process.argv[5];
    var TO_GROUP = process.argv[6];
    var DATABASE_URL = process.argv[7];



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
    incoming.on('connected', function() {
        console.log("[IncomingStream 'connected']");
        console.log("[API.Bots.index return] Firing up bot!", BOT_ID);
    });

    // This waits for messages coming in from the IncomingStream
    // The message is sent to the message processor for analysis
    incoming.on('message', function(message) {
        if(typeof message.data !== "undefined" && message != null){
            
            // Log Message.
            var TEXT = "message undefines";
            if(message.data.subject.text)
                TEXT = message.data.subject.text;
            console.log("[IncomingStream 'message'] Message Received\n" + TEXT);

            // Process message.
            Processor.process(ACCESS_TOKEN, DATABASE_URL, BOT_ID, FROM_GROUP, TO_GROUP, message);
        }

    });

    // This listens for the bot to disconnect
    incoming.on('disconnected', function() {
        console.log("[IncomingStream 'disconnect']");
        if (retryCount > 3) {
            retryCount = retryCount - 1;
            incoming.connect();    
        }
    });

    // This listens for an error to occur on the Websockets IncomingStream.
    incoming.on('error', function() {
        var args = Array.prototype.slice.call(arguments);
        console.log("[IncomingStream 'error']", args);
        if (retryCount > 3) {
            retryCount = retryCount - 1;
            incoming.connect();    
        }
    });


    // This starts the connection process for the IncomingStream
    incoming.connect();
    

    // Refresh Stream
    setInterval(function() {
        // This starts the connection process for the IncomingStream
        incoming.disconnect();
        incoming.connect();
    }, 5 * 60 * 1000);
    

    // Schedule Roster Transfer
    var rule = new Schedule.RecurrenceRule();
        //rule.dayOfWeek = 2;
        //rule.hour = 8;
        rule.minute = 36;
        //rule.minute = 28;

    // Set Up Criteria for Stale Users
    var STALE_CRITERIA = {};
    STALE_CRITERIA.lifetime_posts = 1;
    //STALE_CRITERIA.posts_within = {};
    //STALE_CRITERIA.posts_within.time = {};
    //STALE_CRITERIA.posts_within.time.month = 3;
    //STALE_CRITERIA.posts_within.posts = 1;

    // Instantiate Stale User Class Objecs
    var staleUsers = new StaleUsers(ACCESS_TOKEN, DATABASE_URL, STALE_CRITERIA, FROM_GROUP, TO_GROUP);
    var fromGroupHistory = new History(ACCESS_TOKEN, FROM_GROUP, DATABASE_URL);
    var toGroupHistory = new History(ACCESS_TOKEN, TO_GROUP, DATABASE_URL);

    // Schedule Stale Users for Removal
   // var j = Schedule.scheduleJob(rule, function(){
        var errors = [];
        var responses = [];

        // Remove All Users With a Flag
        
        var removeStaleUsers = function(){
            // Remove Stale Users Who Have Been Warned
            staleUsers.removeStaleUsers(true, function(error, response){
                MembershipUtilities.bindMembers(ACCESS_TOKEN, FROM_GROUP, true, TO_GROUP, false, function(error, response){
                    if(!error || error.length == 0 && response){
                        console.log("\033[94mRoster Subtraction Successful\033[0m");
                    } else {
                        console.log("\033[1;31mRoster Subtraction Failed\033[0m");
                    }
                });
                errors.push(error);
                responses.push(response);
                console.log(errors, responses);
            });  
        }

        // Retrieve Stale Users and Store Them For Processing
        var getStaleUsers = function(){
            // Gather Stale Users
            staleUsers.getStaleUsers(true, false, function(error, response){
                errors.push(error);
                responses.push(response);
                console.log(errors, responses);
                removeStaleUsers();
            });
        }

        // Message and Flag All Stale Users
        /*
        var messageStaleUsers = function(){
            // Generate Message
            var message = "You have been inactive on BAS for some time. To remain in the group, please post a message to the duscussion :)";
            
            staleUsers.messageStaleUsers(message, true, function(error, response){
                errors.push(error);
                responses.push(response);
                console.log(errors, responses);
            });
        } 
        */

        // Handle Callbacks
        var callbackCount = 2;

        fromGroupHistory.compileMessages(function(error, response){
            callbackCount--;
            if(!error || error.length == 0 && response){
                responses.push(response);
                if(callbackCount == 0)
                    getStaleUsers(staleUsers);
            } else {
                errors.push(error);
            }
        });

        toGroupHistory.compileMessages(function(error, response){
            callbackCount--;
            if(!error || error.length == 0 && response){
                responses.push(response);
                if(callbackCount == 0)
                    getStaleUsers(staleUsers);
            } else {
                errors.push(error);
            }
        });

  //  });
}
