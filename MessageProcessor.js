var GroupMe             = require('groupme');
var API                 = require('groupme').Stateless;
var Admin               = require('./index');
var Membership          = Admin.MembershipUtilities;
var History             = Admin.HistoryUtilities;

Incomming               = {};
Incomming.process       = {};

Incomming.process = function(ACCESS_TOKEN, DATABASE_URL, BOT_ID, FROM_GROUP, TO_GROUP, message){

    // Listen for System Messages
    if(message.data.subject.system){
        // Listen for Users Being Added to the Group
        if (message.data 
            && message.data.subject
            && message.data.subject.text
            && message.data.subject.text.indexOf('added') >= 0) { 
            // Bind Outer Join Memberships
            Membership.bindMembers(ACCESS_TOKEN, FROM_GROUP, true, TO_GROUP, true, function(error, response){
                if(!error || error.length == 0 && response){
                    console.log("\033[94mRoster Transferred\033[0m");
                    console.log(response);
                } else {
                    console.log("\033[1;31mRoster Transfer Failed\033[0m");
                    console.log(error);
                }
            });
        } 
    } 
    // Listen to User Messages
    else {

        // Bot Defaults
        var DEFAULT_BOT_AVATAR = 'https://i.groupme.com/780x780.jpeg.0134c9b05a3c0131200322000a2d0ef6';
        var DEFAULT_BOT_NAME = "Manfred";
        var history = new History(ACCESS_TOKEN, FROM_GROUP, DATABASE_URL);
        
        /************************************************************************
         * Message Processing Functions
         ***********************************************************************/
        
        var updateBot = function(params, callback){
            API.Bots.update(
                ACCESS_TOKEN, // Identify the access token
                BOT_ID, // Identify the bot that is sending the message
                params,
                function(error, response) {
                    callback(error, response);
                }
            );  
        }

        
        var BOT_LISTENS_FOR = "|";
        var NAME_MODIFIER = "|";
        var transferMessage = function(text){
            if(text.indexOf(BOT_LISTENS_FOR) >= 0 && BOT_ID && message.data.subject.group_id != TO_GROUP) {
                var params = {
                    name: NAME_MODIFIER + message.data.subject.name, 
                    avatar_url: message.data.subject.avatar_url, 
                    group_id: TO_GROUP};
                updateBot(params, function(error, response) {
                    API.Bots.post(
                        ACCESS_TOKEN, // Identify the access token
                        BOT_ID, // Identify the bot that is sending the message
                        message.data.subject.text.replace(BOT_LISTENS_FOR, ""), // Construct the message
                        {}, // No pictures related to this post
                        function(error,response) {
                            if (error) {
                                console.log("[API.Bots.post] Reply Message Error!");
                            } else {
                                console.log("[API.Bots.post] Reply Message Sent!");
                            }
                        }
                    );      
                }); 
            }
        }


        var COUNT = "#count";
        var YEAR  = "year"
        var MONTH = "month";
        var WEEK  = "week";
        var DAY   = "day";
        var HOUR  = "hour";
        var countMessages = function(text){
            
            var dateParam = {year: 40};
            var messageParam = "";

            if(text.indexOf(YEAR) >= 0){
                dateParam = {year: 1};
                var messageParam = " This Year";
            } else if(text.indexOf(MONTH) >= 0){
                dateParam = {month: 1};
                var messageParam = " This Month";
            } else if(text.indexOf(WEEK) >= 0){
                dateParam = {week: 1};
                var messageParam = " This Week";
            } else if(text.indexOf(DAY) >= 0){
                dateParam = {day: 1};
                var messageParam = " in the Last 24 Hours";
            } else if(text.indexOf(HOUR) >= 0){
                dateParam = {hour: 1};
                var messageParam = " in the Last Hour";
            }
            if(text.indexOf(COUNT) >= 0 && BOT_ID && message.data.subject.group_id != TO_GROUP) {
                if(text.indexOf())
                
                var user = message.data.subject;
                history.compileMessages(function(error, response){
                    // Grab Post Count
                    history.messagesWithin([user], dateParam, true, function(error, response){
                        var messageCount = response[0].message_count;
                        // Update Bot
                        var params = {
                            name: DEFAULT_BOT_NAME, 
                            avatar_url: DEFAULT_BOT_AVATAR,
                            group_id: FROM_GROUP
                        };

                        updateBot(params, function(error, response) {
                            API.Bots.post(
                                ACCESS_TOKEN, // Identify the access token
                                BOT_ID, // Identify the bot that is sending the message
                                message.data.subject.name + ", You Have Posted " + messageCount + " Times" + messageParam + ".", // Construct the message
                                {}, // No pictures related to this post
                                function(error,response) {
                                    if (error) {
                                        console.log("[API.Bots.post] Reply Message Error!");
                                    } else {
                                        console.log("[API.Bots.post] Reply Message Sent!");
                                    }
                                }
                            );      
                        }); 
                    });
                });
            }
        }
        
        // Process the Message Text
        if (message.data && message.data.subject && message.data.subject.text){
            var TEXT = message.data.subject.text;

            transferMessage(TEXT);
            countMessages(TEXT);
        }
    }
}

module.exports = Incomming;