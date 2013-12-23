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
 * Command line arguments. 
 */
var ACCESS_TOKEN = process.argv[2];
var GROUP_ID = process.argv[3];
//var DATABASE_URL = process.argv[4];
var DATABASE_URL = 'localhost:27017/Manfred';


/**
 * Prepare functions for export. 
 */
MessageCompiler               = {};
MessageCompiler.getMessages   = {};

/**
 * GetMessages Class
 *
 * Sets up the the MongoDB collections for the GroupMe
 * group and connects to the database.
 * 
 * Input: groupID
 */
var GetMessages = function(ACCESS_TOKEN, groupID){
    this.groupID = groupID;
    this.accessToken = ACCESS_TOKEN;
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
GetMessages.prototype.retrieveAll = function(callback){
    if(this.accessToken && this.groupID){
        var self = this;
        // Queries the database for the earliest bounds and if not complete, pulls
        // all messages before the earliest stored message in the database.
        this.db.collection("Group" + this.groupID + "Bounds").find({bound : "earliest"}, function(error, response){
            // If Database call successful handle response
            if(!error || error.length == 0){
                // If database call returns empty, log it to the console and call the
                // instatiateBounds methods
                if(response[0] == null){

                    console.log("\033[1;31mEmpty Database\033[0m\n");
                    
                    // Instantiate bounds
                    self.instantiateBounds(1, function(error, response){
                        if(!error || error.length == 0){
                            callback(null, response);
                        }else{
                            callback(error);
                        }
                    });
                }
                // If database response comes back with a lower bound entry
                // determine if the the bound is complete or not
                else{
                    // If the response is not compete begin recursively sending
                    // GET requests to gather all remaining messages.
                    if(!response[0].complete){
                        console.log("\033[92m" + response[0].id + "\033[0m\n");
                        self.before(parseInt(response[0].id), function(error, response){
                            if(!error || error.length == 0){
                                callback(null, response);
                            }else{
                                callback(error);
                            }
                        });
                    }
                    // If the database comes back complete, Log the database as complete
                    else{
                        console.log("\033[92mDatabase Complete\033[0m\n");
                        self.after(function(error, response){
                            if(!error || error.length == 0){
                                callback(null, response);
                            }else{
                                callback(error);
                            }
                        });
                    }
                }
            }
            // If the database call returns and error, log the error.
            else {
                console.log("\033[1;31mDatabase Search Error\033[0m\n");
                callback("Database Bounds Search Error");
            }
        });

    }else{
        console.log("Usage: node MessageCompiler.js ACCESS_TOKEN [group_id]");
    }
}


/**
 * instantiateBounds method
 *
 * create a collection and both an upper and lower bounds document
 * for efficiently pinging the GroupMe API
 */
GetMessages.prototype.instantiateBounds = function(bound, callback) {

    // Instantiate objects.
    var self = this;
    var bounds = {1: "earliest", 2: "lower", 3: "upper", 4: "latest"};

    // Insert an empty lower bound
    this.db.collection("Group" + this.groupID + "Bounds").save({
        bound   : bounds[bound],
        id      : "0",
        complete   : false
        },function(error, response){
            if(!error || error.length == 0){

                // Respond with success
                console.log("\033[92m" + bounds[bound] + " Bound Instantiated\033[0m\n");

                if(bound >= 4) {
                    // End recursion instantiating bounds and begin pulling messages
                    self.before(null, false, function(error, response){
                        if(!error || error.length == 0){
                            callback(null, response);
                        }else{
                            callback(error);
                        }
                    });
                } else {
                    // Iterate and recurse
                    self.instantiateBounds(bound + 1, function(error, response){
                        if(!error || error.length == 0){
                            callback(null, response);
                        }else{
                            callback(error);
                        }
                    });
                }
            } else{
                console.log("\033[1;31m" + bounds[bound] + "Bound Failed to Instantiate\033[0m\n");
                callback(bounds[bound] + "Bound Failed to Instantiate");
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
GetMessages.prototype.before = function(beforeID, checkUpperBound, callback){
    // If options are null, change flag to signal potential bounds update
    if(beforeID == null)
    {
        this.index(null, true, checkUpperBound, function(error, response){
            if(!error || error.length == 0){
                callback(null, response);
            }else{
                callback(error);
            }
        });
    } else {
        this.index({before_id: beforeID}, false, checkUpperBound, function(error, response){
            if(!error || error.length == 0){
                callback(null, response);
            }else{
                callback(error);
            }
        });
    }
}

GetMessages.prototype.after = function(callback){
    var self = this;
    this.db.collection("Group" + this.groupID + "Bounds").find({bound : "lower"}, function(error, response){
        if(!error || error.length == 0){
            self.lowerBound = parseInt(response[0].id);

            self.db.collection("Group" + self.groupID + "Bounds").find({bound : "upper"}, function(error, response){
                if(!error || error.length == 0){
                    self.upperBound = parseInt(response[0].id);
                    if(self.upperBound > self.lowerBound){
                        self.before(self.upperBound, true,  function(error, response){
                            if(!error || error.length == 0){
                                callback(null, response);
                            }else{
                                callback(error);
                            }
                        });
                    } else {
                        self.index(null, true, true,  function(error, response){
                            if(!error || error.length == 0){
                                callback(null, response);
                            }else{
                                callback(error);
                            }
                        });
                    }
                } else {
                    console.log("\033[1;31mDatabase Search Error\033[0m\n");
                    callback("Database Search Error");
                }
            });
        } else{
            console.log("\033[1;31mDatabase Search Error\033[0m\n");
            callback("Database Search Error");
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
GetMessages.prototype.index = function(options, beforeSearch, checkUpperBound, callback){
    var self = this;
    API.Messages.index(
        this.accessToken,
        this.groupID,
        options,
        function(error,response) {
        
            if (!error || error.length == 0 && response) {
                self.responseHandler(response, beforeSearch, checkUpperBound, function(error, response){
                    if(!error || error.length == 0){
                        callback(null, response);
                    }else{
                        callback(error);
                    }
                });
            } else  {
                console.log("\033[1;31mMessage Get Request Response Error\033[0m\n");
                callback("Message Get Request Response Error");
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
GetMessages.prototype.responseHandler = function(response, beforeSearch, checkUpperBound, callback){
    var self = this;
    var length = response.messages.length;
    var messages = response.messages;

    var insertMessages = function(){
        // If the length of the returned message is shorter than 20
        // signals to the databaseInsert method to mark the database as complete
        if(length < 20){
            self.databaseInsert(messages, checkUpperBound, function(error, response){
                if(!error || error.length == 0){
                    responses.push(response);
                }else{
                    errors.push(error);
                }
                callback(errors, responses);
            });  
        }else{
            self.databaseInsert(messages, checkUpperBound, function(error, response){
                if(!error || error.length == 0){
                    responses.push(response);
                }else{
                    errors.push(error);
                }
                callback(errors, responses);
            }); 
        }
    } 
    
    // Array of asynchronous calls to update bounds
    var bounds = [];
    var boundsLength = 0;
    var errors = [];
    var responses = [];
    
    // If latest message update newLatestMessage variable for potential
    // bounds shift
    if(beforeSearch){
        bounds = ["upper", "latest"];
        if(!checkUpperBound){
            bounds.push("lower");
        }     
    }
    boundsLength = bounds.length;
    
    if(boundsLength > 0){
        // Add calls to the array of calls
        for(var i = 0; i < bounds.length ; i++){
            this.modifyBounds(bounds[i], messages[0].id.toString(), false, function(error, response){
                boundsLength --;
                if(!error || error.length == 0){
                    responses.push(response);
                }else{
                    errors.push(error);
                }
                if(boundsLength == 0){
                    insertMessages();  
                }
            });
        }
    } else{
        insertMessages();
    }
}


/**
 * databaseInsert method
 *
 * Inserts the messages into the MongoDB Database recursively and completes the
 * bounds modification after every successful insert.
 *
 * Input: messages, checkUpperBound, callback
 */
GetMessages.prototype.databaseInsert = function(messages, checkUpperBound, callback) { 
    var self = this;
    var waitingNumber = messages.length;
    var length = messages.length;
    var errors = [];
    var responses = [];
    if(length < 20){
        var complete = true;
    } else {
        var complete = false;
    }
    var callAgain = function(){
        if(!complete){
            self.before(messages[length - 1].id, checkUpperBound, function(error, response){
                if(!error || error.length == 0){
                    responses.push(response);
                }else{
                    responses.push(errors);
                }
                callback(errors, responses);
            }); 
        } else{
            console.log("\033[92mDatabase Up To Date\033[0m\n");
            callback(null, "Database up to date");
        }
    }

    console.log(this.lowerBound);
    for(var i = 0 ; i < length; i++){
          // check bounds to see if they merge
        if(checkUpperBound && messages[i].id <= this.lowerBound){
            // get latest bound from database
            self.db.collection("Group" + self.groupID + "Bounds").find({bound : "latest"}, function(error, response){
                if(!error || error.length == 0){
                    var messageID = response[0].id.toString()
                    // Set lower bound to that of latest value
                    self.modifyBounds("lower", messageID, false, function(error, response){
                        if(!error || error.length == 0){
                            // Set upper bound to that of latest bound
                            self.modifyBounds("upper", messageID, false, function(error, response){
                                if(!error || error.length == 0){
                                    callback(null, response);
                                }else{
                                    callback(error);
                                }
                            });
                        }else{
                            callback(error);
                        }
                    }); 
                }else {
                    console.log("\033[1;31mDatabase Search Error\033[0m\n");
                    callback("Database Search Error");
                }
            });
        } else {

            // inserts the message into the database
            this.db.collection("Group" + this.groupID + "Messages").save({
                id              : messages[i].id,
                source_guid     : messages[i].source_guid,
                created_at      : messages[i].created_at,
                user_id         : messages[i].user_id,
                group_id        : messages[i].group_id,
                name            : messages[i].name,
                avatar_url      : messages[i].avatar_url,
                text            : messages[i].text,
                system          : messages[i].system,
                attachments     : messages[i].attachments,
                favorited_by    : messages[i].favorited_by
                },function(error, response){
                    
                    // If the response is successful, log the successful insert, modify bounds
                    // and handle the recursion.
                    if(!error || error.length == 0){
                        // Log insertion
                        console.log("\033[92m Insert Successful\033[0m\n");
                        responses.push(response);
                        waitingNumber --;

                        if(waitingNumber == 0){
                            if(checkUpperBound){
                                self.modifyBounds("upper", messages[length-1].id.toString(), false, function(error, response){   
                                    if(!error || error.length == 0){
                                        responses.push(response);
                                    }else{
                                        responses.push(errors);
                                    }
                                    callAgain();
                                }); 
                            }else{
                                self.modifyBounds("earliest", messages[length-1].id.toString(), complete, function(error, response){

                                    if(!error || error.length == 0){
                                        responses.push(response);
                                    }else{
                                        responses.push(errors);
                                    }
                                    callAgain()
                                });
                            }
                        }
                    } 
                    // If the insert failed log it.
                    else{
                        console.log("\033[1;31mInsertion Error\033[0m\n");
                        callback("Message Insertion Error");
                    }


                }
            );
        }
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
GetMessages.prototype.modifyBounds = function(bounds, messageID, completed, callback){
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
            if(!error || error.length == 0){
                console.log("\033[92m" + bounds + "Bound Update Successful\033[0m\n");
                callback(null, bounds + "Bound Update Successful");
            } else{
                console.log("\033[1;31m" + bounds + "Bound Update Error\033[0m\n");
                callback(bounds + "Bound Update Error");
            }
        }
    );
}


MessageCompiler.getMessages = function(ACCESS_TOKEN, GROUP_ID, callback) {
    var getMessages = new GetMessages(ACCESS_TOKEN, GROUP_ID);
    getMessages.retrieveAll(function(error, response){
        if(!error || error.length == 0){
            callback(null, response);
        }else{
            callback(error);
        }
    });
}


/**
 * Run compiler from command line.
 */
MessageCompiler.getMessages(ACCESS_TOKEN, GROUP_ID, function(error, response){
    if(!error || error.length == 0){
        console.log("Success");
        console.log(response);
        process.exit(code = 0);
    }else{
        console.log("Failure");
        console.log(error);
        process.exit(code = 1);
    }
});


/**
 * Export functions to be used by node.
 */
module.exports = MessageCompiler;
