//TODO: Make Recent Message gathering more robust in storing latest message bounds
//TODO: Set Timeouts for API calls and a resetting failure countdown
//TODO: Close database connection
//TODO: Group And Token inputs through commandline ARGV
//TODO: Make calls Asyncronously managing failed responses


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
this.lowerBound;
this.upperBound;

var collections = ["Group" + this.groupID + "Messages", "Group" + this.groupID + "Bounds"];
this.db = mongojs.connect(DATABASE_URL, collections);
}



/**
 * retrieveAll method
 *
 * Initiates the asyncronous recursive retrieval of
 * all messages of the group not stored in the database
 */
GetMessages.prototype.retrieveAll = function(){
    var self = this;
    // Queries the database for the earliest bounds and if not complete, pulls
    // all messages before the earliest stored message in the database.
    this.db.collection("Group" + this.groupID + "Bounds").find({bound : "earliest"}, function(error, response){
        // If Database call successful handle response
        if(!error){
            // If database call returns empty, log it to the console and call the
            // instatiateBounds methods
            if(response[0] == null){
                // Insert and empty lower bound
                console.log("\033[1;31mEmpty Database\033[0m\n");
                self.instantiateBounds("earliest");
                self.instantiateBounds("lower");
                self.instantiateBounds("upper");
                self.instantiateBounds("latest");
            }
            // If database response comes back with a lower bound entry
            // determine if the the bound is complete or not
            else{
                // If the response is not compete begin recursively sending
                // GET requests to gather all remaining messages.
                if(!response[0].complete){
                    console.log("\033[92m" + response[0].id + "\033[0m\n");
                    self.before(parseInt(response[0].id));
                }
                // If the database comes back complete, Log the database as complete
                else{
                    console.log("\033[92mDatabase Complete\033[0m\n");
                    
                    self.after(); 
                }
            }
        }
        // If the database call returns and error, log the error.
        else {
            console.log("\033[1;31mDatabase Search Error\033[0m\n");
        }
    });
}


/**
 * instantiateBounds method
 *
 * create a collection and both an upper and lower bounds document
 * for efficiently pinging the GroupMe API
 */
GetMessages.prototype.instantiateBounds = function(bound) {
    var self = this;
    // Insert an empty lower bound
    this.db.collection("Group" + this.groupID + "Bounds").save({
        bound   : bound,
        id      : "0",
        complete   : false
        },function(error, response){
            if(!error){
                if(bound == "latest")
                {
                    self.before(null, false);
                }
                console.log("\033[92m" + bound + " Bound Instantiated\033[0m\n");
            } else{
                console.log("\033[1;31m" + bound + "Bound Failed to Instantiate\033[0m\n");
            }
        }
    );
}

/**
 * before method
 *
 * Calls the index function with the peramiters to grab messages prior
 * to the specified message
 *
 * Input: beforeID
 */
GetMessages.prototype.before = function(beforeID, checkUpperBound){
    // If options are null, change flag to signal potential bounds update
    if(beforeID == null)
    {
        this.index(null, true, checkUpperBound);
    } else {
        this.index({before_id: beforeID}, false, checkUpperBound);
    }
}

GetMessages.prototype.after = function(){
    var self = this;
    this.db.collection("Group" + this.groupID + "Bounds").find({bound : "lower"}, function(error, response){
        if(!error){
            self.lowerBound = parseInt(response[0].id);

            self.db.collection("Group" + self.groupID + "Bounds").find({bound : "upper"}, function(error, response){
                if(!error){
                    self.upperBound = parseInt(response[0].id);
                    if(self.upperBound > self.lowerBound){
                        self.before(self.upperBound, true);
                    } else {
                        self.index(null, true, true);
                    }
                } else {
                    console.log("\033[1;31mDatabase Search Error\033[0m\n");
                }
            });
        } else{
            console.log("\033[1;31mDatabase Search Error\033[0m\n");
        }
    });
}

/**
 * index method
 *
 * Sends a GET request to the GroupMe API to grab messages, the response is
 * sent to the response handler message to process and recurse
 *
 * Input: options, before, checkUpperBound
 */
GetMessages.prototype.index = function(options, beforeSearch, checkUpperBound){
    var self = this;
    API.Messages.index(
        ACCESS_TOKEN,
        this.groupID,
        options,
        function(error,response) {
            //
            if (!error && response) {
                self.responseHandler(response, beforeSearch, checkUpperBound);  
            } else  {
                console.log("\033[1;31mResponse Error\033[0m\n");
            }
        }
    )
}


/**
 * reponseHandler method
 *
 * Handles the response from the GroupMe API call, processes the recursion
 * and calls methods to insert them into the database
 *
 * Input: response, beforeSearch, checkUpperBound
 */
GetMessages.prototype.responseHandler = function(response, beforeSearch, checkUpperBound){
    var length = response.messages.length;
    var messages = response.messages;
    // If latest message update newLatestMessage variable for potential
    // bounds shift
    if(beforeSearch){
        this.modifyBounds("upper", messages[0].id.toString(), false);
        this.modifyBounds("latest", messages[0].id.toString(), false);

        this.upperBound = messages[0].id;

        if(!checkUpperBound){
            this.modifyBounds("lower", messages[0].id.toString(), false);
        }
    }
    // If the length of the returned message is shorter than 20
    // signals to the databaseInsert method to mark the database as complete
    if(length < 20){
        this.databaseInsert(messages, 0, length, true, checkUpperBound);   
    }else{
        this.databaseInsert(messages, 0, length, false, checkUpperBound);
    }  
}


/**
 * databaseInsert method
 *
 * Inserts the messages into the MongoDB Database recursively and completes the
 * bounds modification after every successful insert.
 *
 * Input: messages, counter, length, finished, checkUpperBound
 */
GetMessages.prototype.databaseInsert = function(messages, counter, length, finished, checkUpperBound) { 
    var self = this;
    var complete = false;

    // check bounds to see if they merge
    if(checkUpperBound && messages[counter].id <= this.lowerBound){
        this.modifyBounds("upper", messages[counter].id.toString(), false);
        self.db.collection("Group" + self.groupID + "Bounds").find({bound : "latest"}, function(error, response){
            if(!error){
                self.modifyBounds("lower", response[0].id.toString(), false);
                self.modifyBounds("upper", response[0].id.toString(), false);
            }else {
                console.log("\033[1;31mDatabase Search Error\033[0m\n");
            }
        });
    } else {

        // Marks the completion peramter to be inserted into the database as true
        // for the final message.
        if(counter == (length - 1) && finished){
            complete = true;
        }
        // inserts the message into the database
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
                // If the response is successful, log the successful insert, modify bounds
                // and handle the recursion.
                if(!error){
                    console.log("\033[92m" + (counter + 1).toString() + "/" + length.toString() + " Insert Successful\033[0m\n");
                    if(checkUpperBound){
                        self.modifyBounds("upper", messages[counter].id.toString(), false); 
                    }else{
                        self.modifyBounds("earliest", messages[counter].id.toString(), complete);
                    }

                    // If all of the messages have been processed call the before function
                    // to loop through the next set of API calls
                    if(counter >= (length - 1)){
                        console.log("\033[92mGet Request Stored\033[0m\n");
                        if(length == 20){
                            self.before(messages[counter].id, checkUpperBound);
                        }
                    }
                    // If there are more messages to process call the databaseInsert message
                    // to recursively insert all messages from this call into the database.
                    else{
                        self.databaseInsert(messages, (counter + 1), length, finished, checkUpperBound);
                    }
                } 
                // If the insert failed log it.
                else{
                    console.log("\033[1;31mInsert Error\033[0m\n");
                }
            }
        );
    }
}


/**
 * modifyBounds method
 *
 * Updates the MongoDB bounds collection to store current message bounds information
 * for efficient GroupMe API calls.
 *
 * Input: bounds, messageID, completed
 */
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
                console.log("\033[92m" + bounds + "Bound Update Successful\033[0m\n");
            } else{
                console.log("\033[1;31m" + bounds + "Bound Update Error\033[0m\n");
            }
        }
    );
}


ACCESS_TOKEN = 'c74e9900384b013104357e620898ea29';
var GROUP_ID = '6391102';

var getMessages = new GetMessages(GROUP_ID);
getMessages.retrieveAll();
