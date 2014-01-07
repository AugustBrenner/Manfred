var GroupMe             = require('groupme');
var API                 = require('groupme').Stateless;
var Admin               = require('./index');
var Membership          = Admin.MembershipUtilities;

Incomming               = {};
Incomming.process       = {};

Incomming.process = function(ACCESS_TOKEN, bot_id, FROM_GROUP, TO_GROUP, message){

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

        var BOT_LISTENS_FOR = "|";
        var NAME_MODIFIER = "|";

        if (message.data 
            && message.data.subject
            && message.data.subject.text
            && message.data.subject.text.indexOf(BOT_LISTENS_FOR) >= 0) {
            if (bot_id && message.data.subject.TO_GROUP != TO_GROUP) {
                
                var params = {name: NAME_MODIFIER + message.data.subject.name, avatar_url: message.data.subject.avatar_url};
                API.Bots.update(
                    ACCESS_TOKEN, // Identify the access token
                    bot_id, // Identify the bot that is sending the message
                    params,
                    function(error, response) {
                
                        API.Bots.post(
                            ACCESS_TOKEN, // Identify the access token
                            bot_id, // Identify the bot that is sending the message
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
                    }
                ); 
            }
        }
    }
}

module.exports = Incomming;