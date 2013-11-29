/**
 * Module dependencies.
 */

var GroupMe = require('groupme');
var API = require('groupme').Stateless;
var mongojs = require('mongojs');


/**
 * Database Address 
 */
var DATABASE_URL = 'localhost:27017/Manfred';


/**
 * GetMessages Class
 *
 * Sets up the the MongoDB collections for the GroupMe
 * group and connects to the database.
 * 
 * Input: groupID
 */
var GetMessages = function(groupID){
this.groupID = groupID;

var collections = ["Group" + this.groupID + "Messages", "Group" + this.groupID + "Bounds"];
this.db = mongojs.connect(DATABASE_URL, collections);
}



/**
 * retrieveAll method
 *
 * Initiates the asyncronous recursive retrieval of
 * all messages of the group not stored in the database
 * 
 */
GetMessages.prototype.retrieveAll = function(){
    var self = this;
    // Queries the database for the earliest bounds and if not complete, pulls
    // all messages before the earliest stored message in the database.
    this.db.collection("Group" + this.groupID + "Bounds").find({bound : "earliest"}, function(error, response){
        if(!error){
            if(response[0] == null){
                console.log("\033[1;31mEmpty Database\033[0m\n");
                
                self.db.collection("Group" + self.groupID + "Bounds").save({
                    bound   : "latest",
                    id      : "0",
                    complete   : false
                    },function(error, response){
                        if(!error){
                            console.log("\033[92mLower Bound Instantiated\033[0m\n");
                        } else{
                            console.log("\033[1;31mLower Bound Failed to Instantiate\033[0m\n");
                        }
                    }
                );
                
                self.db.collection("Group" + self.groupID + "Bounds").save({
                    bound   : "earliest",
                    id      : "0",
                    complete   : false
                    },function(error, response){
                        if(!error){
                            console.log("\033[92mLower Bound Instantiated\033[0m\n");
                            self.index(null);
                        } else{
                            console.log("\033[1;31mLower Bound Failed to Instantiate\033[0m\n");
                        }
                    }
                );
            } else{
                if(!response[0].complete){
                    console.log("\033[92m" + response[0].id + "\033[0m\n");
                    self.before(parseInt(response[0].id));
                }else{
                    console.log("\033[92mDatabase Complete\033[0m\n")  
                }
            }
        } else {
            console.log("\033[1;31mDatabase Search Error\033[0m\n");
        }
    });
}


GetMessages.prototype.before = function(beforeID){
    this.index({before_id: beforeID}, true);
}


GetMessages.prototype.index = function(options){
    var self = this;
    API.Messages.index(
        ACCESS_TOKEN,
        this.groupID,
        options,
        function(error,response) {
            if (!error) {
                self.responseHandler(response);  
            } else  {
                console.log("\033[1;31mResponse Error\033[0m\n");
            }
        }
    )
}

GetMessages.prototype.responseHandler = function(response){
    var length = response.messages.length;
    var messages = response.messages;
    if(length < 20){
        console.log(response.messages);
        this.databaseInsert(messages, 0, length, true);   
    }else{
        console.log(response.messages);
        this.databaseInsert(messages, 0, length, true);
    }  
}

GetMessages.prototype.databaseInsert = function(messages, counter, length, finished) { 
    var self = this;
    var complete = false;
    if(counter == (length - 1) && finished){
        complete = true;
    }
    this.db.collection("Group" + this.groupID + "Messages").save({
        id              : messages[counter].id,
        source_guid     : messages[counter].source_guid,
        created_at      : messages[counter].created_at,
        user_id         : messages[counter].user_id,
        group_id        : messages[counter].group_id,
        name            : messages[counter].name,
        avatar_url      : messages[counter].avatar_url,
        text            : messages[counter].text,
        system          : messages[counter].system,
        attachments     : messages[counter].attachments,
        favorited_by    : messages[counter].favorited_by
        },function(error, response){
            if(!error){
                console.log("\033[92m" + (counter + 1).toString() + "/" + length.toString() + " Insert Successful\033[0m\n");
                self.modifyBounds("earliest", messages[counter].id.toString(), complete);
                if(counter >= (length - 1)){
                    console.log("\033[92mGet Request Stored\033[0m\n");
                    if(length == 20){
                        self.before(messages[counter].id);
                    }
                } else{
                    self.databaseInsert(messages, (counter + 1), length, finished);
                }
            } else{
                console.log("\033[1;31mInsert Error\033[0m\n");
            }
        }
    );
}

GetMessages.prototype.modifyBounds = function(bounds, messageID, completed){
    this.db.collection("Group" + this.groupID + "Bounds").update(
    {
            bound   : bounds
        },
        {   
            $set: 
            { 
                id          : messageID,
                complete    : completed
            }
        },function(error, response){
            if(!error){
                console.log("\033[92mBound Update Successful\033[0m\n");
            } else{
                console.log("\033[1;31mBound Update Error\033[0m\n");
            }
        }
    );
}


ACCESS_TOKEN = 'c74e9900384b013104357e620898ea29';
var GROUP_ID = '6391102';

var getMessages = new GetMessages(GROUP_ID);
getMessages.retrieveAll('138548488212805088');
