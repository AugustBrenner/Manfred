var GroupMe             = require('groupme');
var API                 = require('groupme').Stateless;

Incomming               = {};
Incomming.process       = {};

Incomming.process = function(ACCESS_TOKEN, bot_id, message){

    var BOT_LISTENS_FOR = "|";

    if (message["data"] 
        && message["data"]["subject"] 
        && message["data"]["subject"]["text"]
        && message["data"]["subject"]["text"].indexOf(BOT_LISTENS_FOR) >= 0) {
        if (bot_id && message["data"]["subject"]["name"] != "BOT") {
            API.Bots.post(
                ACCESS_TOKEN, // Identify the access token
                bot_id, // Identify the bot that is sending the message
                message["data"]["subject"]["name"]+ ":" + message["data"]["subject"]["text"].replace(BOT_LISTENS_FOR, ""), // Construct the message
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
    }
}

module.exports = Incomming;