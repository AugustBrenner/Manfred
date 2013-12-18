var GroupMe             = require('groupme');
var API                 = require('groupme').Stateless;

Incomming               = {};
Incomming.process       = {};

Incomming.process = function(ACCESS_TOKEN, bot_id, group_id, message){

    var BOT_LISTENS_FOR = "|";
    var NAME_MODIFIER = "|"

    if (message.data 
        && message.data.subject
        && message.data.subject.text
        && message.data.subject.text.indexOf(BOT_LISTENS_FOR) >= 0) {
        if (bot_id && message.data.subject.group_id != group_id) {
            
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

module.exports = Incomming;