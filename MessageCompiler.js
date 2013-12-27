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
    this.latestBound;
    this.earliestBound;

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
        var self 			= this;
        var errors 			= [];
        var responses 		= [];
        var callbackCount 	= 0;


        // Queries the database for the earliest bounds and if not complete, pulls
        // all messages before the earliest stored message in the database.
        this.db.collection("Group" + this.groupID + "Bounds").find().sort({bound: -1}, function(error, response){
 			var callbackNumber = 0;
            // If Database call successful handle response
            if(!error || error.length == 0){
                
                var bounds = response;
                // If database call returns empty, log it to the console and call the
                // instatiateBounds methods
                if(!bounds[0] || !bounds[1] || !bounds[2] || !bounds[3]){

                    console.log("\033[93mEmpty Database\033[0m");
                    
                    // Instantiate bounds
                    self.instantiateBounds(function(error, response){
                        if(!error || error.length == 0){
                            // updateBounds
                            self.newBounds(["lower", "upper", "latest"], function(error, response){
		                        if(!error || error.length == 0){
		                            self.getMessages(0, parseInt(response), function(error, response){
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
                        }else{
                            callback(error);
                        }
                    });
                }

                // If database response comes back with bound entries
                // determine if the the bound is complete or not
                else{

                	var getRemaining = function(){ 

                		self.newBounds(["latest"], function(error, response){
	                        if(!error || error.length == 0){
	                        	var latest = parseInt(response);

	                            self.getMessages(self.latestBound, latest, function(error, response){
			                        if(!error || error.length == 0){
			                        	self.modifyBounds(["latest"], latest.toString(), false, function(error, response){   
							            	if (!error || error.length == 0 && response) {   
								            		console.log("\033[92mNew Retrieval Complete\033[0m");
								            		responses.push(response);
			                            			callback(errors, responses);
							                } else {
							                    errors.push(error);
			                            		callback(errors, responses);
							                }
							            });
			                        }else{
			                        	errors.push(error);
			                            callback(errors, responses);
			                        }
			                    });
	                        }else{
	                        	errors.push(error);
	                            callback(errors, responses);
	                        }
	                    });	
                	}


                	// Get Bounds
                	self.upperBound 	= parseInt(bounds[0].id);
                	self.lowerBound 	= parseInt(bounds[1].id);
                	self.latestBound 	= parseInt(bounds[2].id);
                	self.earliestBound	= parseInt(bounds[3].id);

                	// If the upper bound is higher than the lower bound, retrieve all messages between them.
                	if(self.upperBound > self.lowerBound){
                		console.log("\033[94mMerging Message Data\033[0m");
                		var latest	= self.latestBound;
                		callbackNumber++;
                		self.getMessages(self.lowerBound, self.upperBound, function(error, response){
	                        if(!error || error.length == 0){
	                        	// Store new latest bound
				                self.modifyBounds(["upper", "lower"], latest.toString(), false, function(error, response){   
					            	if (!error || error.length == 0 && response) {   
						            		responses.push(response);
					                } else {
					                    errors.push(error);
					                }
					            });
	                        }else{
	                            errors.push(error);
	                        }
	                        callbackNumber--;
	                        if(callbackNumber == 0){
	                        	getRemaining();
	                        }
	                    });
                	}

                	// If the lowest bound is not complete
                	var earliest = parseInt(bounds[3].id);
                	if(!bounds[3].complete && earliest != 0){
                		console.log("\033[94mCollecting Earlier Message Data\033[0m");
                		callbackNumber++;
                		self.getMessages(0, self.earliestBound, function(error, response){
	                        if(!error || error.length == 0){
	                            responses.push(response);
	                        }else{
	                            errors.push(error);
	                        }
	                        callbackNumber--;
	                        if(callbackNumber == 0){
	                        	getRemaining();
	                        }
	                    });
                	}

                	// Retrieve All Remaining Messages
                	if(callbackNumber == 0){
                		console.log("\033[94mUpdating Message Data\033[0m");
                    	getRemaining();
                    }
                }
            }
            // If the database call returns and error, log the error.
            else {
                console.log("\033[1;31mDatabase Search Error\033[0m");
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
GetMessages.prototype.instantiateBounds = function(callback) {

    // Instantiate objects.
    var self = this;
    var bounds = {0: "earliest", 1: "lower", 2: "upper", 3: "latest"};
    var boundsLength = 4;
    var errors 		= [];
    var responses 	= [];

    for(var i = 0; i < 4; i++){
	    // Insert an empty lower bound
	    this.db.collection("Group" + this.groupID + "Bounds").save({
	        bound   : bounds[i],
	        id      : "0",
	        complete   : false
	        },function(error, response){
	            if(!error || error.length == 0){

                // Respond with success
                console.log("\033[92mBound Instantiated\033[0m");
                responses.push(response);

	            } else{
	                console.log("\033[1;31m" + bounds[bound] + " Bound Failed to Instantiate\033[0m");
	                errors.push(error);
	            }
	            boundsLength--;
	            if(boundsLength == 0){
	            	callback(errors, responses);
	            }
      	});
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
	var errors = [];
	var length = bounds.length;
    var callbackCount = length;

	for(var i = 0; i < length; i++){
	    this.db.collection("Group" + this.groupID + "Bounds").update(
	    {
	            bound   : bounds[i]
	        },
	        {   
	            $set: 
	            { 
	                id          : messageID,
	                complete    : completed
	            }
	        },function(error, response){
	            if(!error || error.length == 0){
	                console.log("\033[92m" + bounds + " Bound Update Successful\033[0m");
	            } else{
	                console.log("\033[1;31m" + bounds + "Bound Update Error\033[0m");
	                errors.push(bounds + "Bound Update Error");
	            }
	            callbackCount--;
                if(callbackCount == 0){
                	callback(errors, "Bounds Updated Successfully");
                }
	        }
	    );
	}
}





/**
 * newBounds Method
 *
 * Sends a GET request to the GroupMe API to grab the latest message
 and sets that as the new latest bound
 *
 * Input: callback
 */
GetMessages.prototype.newBounds = function(bounds, callback){
	var self = this;

	API.Messages.index(
        this.accessToken,
        this.groupID,
        null,
        function(error,response) {
        	
        	var latest = response.messages[0].id;

            if (!error || error.length == 0 && response) {

                // Store new latest bound
                self.modifyBounds(bounds, latest.toString(), false, function(error, response){   
	                if(!error || error.length == 0){
	                	callback(null, latest);	
	                }else{
	                    callback(error)
	                }
	            });
            } else  {
                console.log("\033[1;31mLatest Message Get Request Response Error\033[0m");
                callback("Latest Message Get Request Response Error");
            }
        }
    );
}


/**
 * index method
 *
 * Sends a GET request to the GroupMe API to grab messages, the response is
 * sent to the response handler message to process and recurse
 *
 * Input: options, before, checkUpperBound
 */
GetMessages.prototype.getMessages = function(lower, upper, callback){
    var self = this;
    var count = 0;
    var errors = [];
    var bound;
    if(lower == 0){
    	bound = ["earliest"];
    } else {
    	bound = ["upper"];
    }

    options = {before_id: upper};
    var flag = true;
    var stored = true;

    var messagesPost = function(){
	    API.Messages.index(
	        self.accessToken,
	        self.groupID,
	        options,
	        function(error,response) { 

	        	// Modify Count
	        	count++;

	            if (!error || error.length == 0 && response) {

	            	var messages = response.messages;

	            	// Loop through the array, popping off entries older than lower.
	            	var i = messages.length;
	            	var flag = true;
	            	while(i > 0 && flag){
	            		i--
	            		if(messages[i].id <= lower){
	            			messages.pop();
	            		} else {
	            			flag = false;
	            		}
	            	}

	            	// If less than 20 messages remain mark as completed.
	            	var completed = false;
	            	var length = messages.length;
	            	if(length < 20){
	            		completed = true;
	            	}

	            	if (length != 0){
		            	// Insert Messages into Database.
		            	self.databaseInsert(response, function(error, response){
	            			if(!error || error.length == 0 && response){
	            				console.log("\033[92mMessages Stored [" + count + "]\033[0m");
	            				// Store new latest bound
				                self.modifyBounds(bound, messages[length -1].id.toString(), completed, function(error, response){   
					            	if (!error || error.length == 0 && response) {   
										if(completed) {
						            		console.log("\033[92mRetrieval Complete\033[0m");
						            		callback(null, "Retrieval Complete");
					            		}
					                } else {
					                    stored = false;
					                }
					            });
	            			} else {
	            				console.log("\033[92mMessage Storage Failure\033[0m");
	            				errors.push(error);
	            				stored = false;
	            			}
	            		});

		            	// If not completed and no storage error detected, recurse.
		            	if(!completed && stored){
		            		self.earliestBound = messages[19].id;
		            		options = {before_id: messages[19].id};
		            		console.log("\033[92mMessage Get Response Success\033[0m");
		            		messagesPost();
		            	} else if(!stored){
		            		console.log(errors);
		            		callback(errors);
		            	}
		            } else {
		            	console.log("\033[93mNo New Messages\033[0m");
		            	callback(null, "No New Messages");
		            }

	            } else  {
	            	console.log("\033[93mMessage Get Request Response Error\033[0m");
	            	self.modifyBounds(["earliest"], self.earliestBound, true, function(error, response){   
		            	if (!error || error.length == 0 && response) {   
			            		console.log("\033[92mRetrieval Complete\033[0m");
			            		callback(null, "Retrieval Complete");
		                } else {
		                    callback(error);
		                }
		            });
	            }
	        }
	    );
	}

	messagesPost();
}





/**
 * databaseInsert method
 *
 * Inserts the messages into the MongoDB Database recursively and completes the
 * bounds modification after every successful insert.
 *
 * Input: messages, checkUpperBound, callback
 */
GetMessages.prototype.databaseInsert = function(messages, callback) {
    var messagesArray = messages.messages;
    var self = this;

    // inserts the message into the database
    this.db.collection("Group" + this.groupID + "Messages").insert(messagesArray, function(error, response){
           
        // If the response is successful, log the successful insert, modify bounds
        // and handle the recursion.
        if(!error || error.length == 0){
            // Log insertion
            console.log("\033[92mInsertion Successful\033[0m");
			callback(null, response);
        } 
        // If the insert failed log it.
        else{
            console.log("\033[1;31mInsertion Error\033[0m");
            callback(error);
        }
    });
}




/**
 * MessageCompiler getMessages method
 *
 * Exported prototype method to run the get messages Prototype Class.
 *
 * Input: ACCESS_TOKEN, GROUP_ID, callback
 */
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