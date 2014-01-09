
/************************************************************************
 * External Dependencies 
 ***********************************************************************/

var mongojs 			= require('mongojs');
var GroupMeAdmin		= require('./groupme-admin');
var HistoryUtilities   	= require('./HistoryUtilities');
var MembershipUtilities	= require('./MembershipUtilities');


/************************************************************************
 * Utilities Containers
 ***********************************************************************/

// All the functions take the form function(options,callback);
// and all callbacks take the form function(error,return);

/**
 * StaleUsers function
 *
 * Stored ACCESS_TOKEN, GROUP_ID, and DATABASE_URL for use by prototype functions
 *
 * ACCESS_TOKEN		- String, personal access token for GroupMe API
 * GROUP_ID 		- String, ID for the group whose data is to be accessed
 * DATABASE_URL		- String, the URL to the database for persistant storage
 * conditions 		- Object, [optional] contains conditions required of active users
 *						{
 *							"lifetime_posts" : [total number of posts to this group],
 *							"posts_within": {
 *								"time": {
 *			 						second: 	int,
 *			 						minute: 	int,
 *			 						hour: 		int,
 *			 						day: 		int,
 *			 						week: 		int,
 *			 						month: 		int,
 *			 						year: 		int
 *								},
 *								"posts": [number of posts in this period]
 *							}
 *						}
 */
var StaleUsers = function(ACCESS_TOKEN, DATABASE_URL, CONDITIONS, GROUP_ID) {
	
	// Set Variables
	this.accessToken = ACCESS_TOKEN;
	this.staleConditions = null
 	this.staleConditions = CONDITIONS;
 	this.groupID = GROUP_ID;
 	this.allGroups = [GROUP_ID];
	
	// Handle Optional Bound Group
	if(arguments.length > 4){
		for(var i = 4, len = arguments.length; i < len; i++){
			this.allGroups.push(arguments[i]);
		}
	}

	// Connect to Database if Passed DATABASE_URL
	if(DATABASE_URL){
		this.databaseURL = DATABASE_URL;
		
		// Set Database Collections
		var collections = [
		    "Group" + this.groupID + "StaleUsers", 
		];

		// Connect to Database    
	    this.db = mongojs.connect(this.databaseURL, collections);
	}
}


/************************************************************************
 * Exported Utility Functions
 ***********************************************************************/


/**
 * setConditions function
 *
 * Setter function for stale conditions
 *
 * CONDITIONS 		- Object, contains conditions required of active users
 *						{
 *							"lifetime_posts" : [total number of posts to this group],
 *							"posts_within": {
 *								"time": {
 *			 						second: 	int,
 *			 						minute: 	int,
 *			 						hour: 		int,
 *			 						day: 		int,
 *			 						week: 		int,
 *			 						month: 		int,
 *			 						year: 		int
 *								},
 *								"posts": [number of posts in this period]
 *							}
 *						}
 */
 StaleUsers.prototype.setConditions = function(CONDITIONS){
 	this.staleConditions = CONDITIONS
 }


/**
 * getStaleUsers function
 *
 * Gets a list of users that meet the stale user conditions
 *
 * store 			- Boolean, true - stores the callback list in mongoDB 
 * warned 			- Boolean, true - stored stale users are flagged as warned
 * callback 		- Returns a list of stale users
 */
 StaleUsers.prototype.getStaleUsers = function(store, warned, callback){
 	// Maintain Scope
 	var self = this;

 	if(this.staleConditions == null){
 		console.log("\033[1;31mNo Stale Conditions Set\033[0m");
 		callback("No Stale Conditions Set");
 	} else {

 		// Instantiate Lists
 		var allUsers 	= [];
 		var lifetime 	= [];
 		var within 		= [];

 		// Process Lists
 		var processUsers = function(){
 			if(allUsers.length > 1){
 				
 				// Populate Dictionary of Active Users
 				var activeUsers = {};
 				if(lifetime.length > 0){
 					var lifetimeRequirement = self.staleConditions.lifetime_posts;
 					for(var i = 0, len = lifetime.length; i < len; i ++){
 						if(lifetime[i].message_count > lifetimeRequirement)
 							activeUsers[lifetime[i].user_id] = lifetime[i];
 					}
 				}
 				if(within.length > 0){
 					var withinRequirement = self.staleConditions.posts_within.posts;
 					for(var i = 0, len = within.length; i < len; i ++){
 						if(within[i].message_count > withinRequirement)
 							activeUsers[within[i].user_id] = within[i];
 					}
 				}
 				
 				// Compare Roster Against List of Active Users to Find Stale Users
 				var staleUsers = [];
 				var activeArray = [];
 				for(var i = 0, len = allUsers.length; i < len; i ++){
					if(activeUsers[allUsers[i].user_id] == null){
						staleUsers.push(allUsers[i]);
					} else {
						activeArray.push(allUsers[i]);
					}
				}
				// Return staleUsers List
				if(store){
					self.storeStaleUsers(staleUsers, warned, function(error, response){
				        self.restoreActiveUsers(activeArray, function(error, response){
				        	if(!error || error.length == 0 && response){
				        		callback(error, staleUsers);
					        } else {
					            callback(error, response);
					        }
        				});
					});
				} else {
					callback(null, staleUsers);
				}
 			} else {
 				callback(null, "No Users in Group");
 			}
 		}


	 	// Manage Callbacks
	 	callbackCount = 0;

	 	// Get Group Roster
	 	callbackCount++;
	 	MembershipUtilities.gatherRoster(this.accessToken, this.groupID, function(error, response){
	 		callbackCount--;
		    if(!error || error.length == 0 && response){
		    	// Set allUsers List to Response Value
		    	allUsers = response;
	            if( callbackCount == 0)
	 				processUsers();
	        } else {
	            callback(error, response);
	        }
	 	});

	 	
	 	// Get Members that meet posting Conditions

	 	for(var i = 0, len = this.allGroups.length; i < len; i++){
		 	// Instantiate HistoryUtilities
	 		historyUtilities = new HistoryUtilities(this.accessToken, this.groupID, this.databaseURL);

		 	if(this.staleConditions.lifetime_posts){
			 	callbackCount++;
			 	historyUtilities.postedWithin({year:40}, true, function(error, response){
			 		callbackCount--;
				    if(!error || error.length == 0 && response){
				    	// Set lifetime List to Response Value
				    	if(response.length > 0)
				    		lifetime.push.apply(lifetime, response);
			            if( callbackCount == 0)
			 				processUsers();
			        } else {
			            callback(error, response);
			        }
			 	});
			}
			if(this.staleConditions.posts_within){
			 	callbackCount++;
			 	historyUtilities.postedWithin(this.staleConditions.posts_within.time, true, function(error, response){
			 		callbackCount--;
				    if(!error || error.length == 0 && response){
				    	// Set within List to Response Value
				    	if(response.length > 0)
				    		within.push.apply(within, response);
			            if( callbackCount == 0)
			 				processUsers();
			        } else {
			            callback(error, response);
			        }
			 	});
			}
		}
	} 
}


/**
 * restoreActiveUsers method
 *
 * removes active members from the MongoDB Database.
 *
 * activeUsers 		- Array, containing member objects of active users
 * callback 		- callback, returns the last error from the bulk insert or the success response
 */
StaleUsers.prototype.restoreActiveUsers = function(activeUsers, callback) {
	// Maintain Scope
	var self = this;

	var errors 			= [];
	var responses 		= [];
	var callbackCount 	= 0;

	var restoreUsers = function(user, callback){

		var userID = user.user_id;
		// inserts the users into the database
	    self.db.collection("Group" + self.groupID + "StaleUsers").remove({'user_id': userID}, function(error, response){
	        if(!error || error.length == 0){
	        	if(response > 0){
	        		console.log("\033[92mActive User," + user.nickname + ":" + user.user_id + ", Restored Successfully\033[0m");
	        	}
				callback(error, response);
	        } else{
	        	console.log("\033[1;31mActive User," + user.nickname + ":" + user.user_id + ", Failed to Restored\033[0m");
	            callback(error, response);
	        }
	    });
	}
	if(activeUsers && activeUsers.length > 0){
		// Loop Through List Removing Entries from DB
		for(var i = 0, len = activeUsers.length; i < len; i ++){
			callbackCount++;
			restoreUsers(activeUsers[i], function(error, response){
				callbackCount--
				if(!error || error.length == 0){
					responses.push(response);
		        } else{
		            errors.push(error);
		        }
		        if(callbackCount == 0){
		        	callback(errors, responses);
		        }
			});
		}
	} else {
		console.log("\033[93mNo Users to Restore\033[0m");
		callback(null, "No Users to Restore");
	}
}


/**
 * storeStaleUsers method
 *
 * Inserts the stale users into the MongoDB Database.
 *
 * staleUsers 		- Array, containing member objects of stale users
 * warned 			- Boolean, true - stored stale users are flagged as warned
 * callback 		- callback, returns the last error from the bulk insert or the success response
 */
StaleUsers.prototype.storeStaleUsers = function(staleUsers, warned, callback) {

	// Add Unique ID and Warning Notification Boolean
	for(var i = 0, len = staleUsers.length; i < len; i ++){
		staleUsers[i]["_id"] = staleUsers[i].user_id;
		staleUsers[i]["warned"] = warned;
	}

    // inserts the users into the database
    this.db.collection("Group" + this.groupID + "StaleUsers").insert(staleUsers, function(error, response){
           
        // If the response is successful, log the successful insert
        if(!error || error.length == 0){
            console.log("\033[92mStale User Insertions Successful\033[0m");
			callback(null, response);
        } 
        // If the insert failed log it.
        else{
            console.log("\033[1;31mStale User Insertions Error\033[0m");
            callback(error);
        }
    });
}


/**
 * Return Stale Users method
 *
 * Returns a list of all stale useres stored in the db
 *
 * callback 		- callback, returns the last error from the multi update or the success response
 */
StaleUsers.prototype.returnStaleUsers = function(callback) {
	// Retrieve Stale User List and Message
	this.db.collection("Group" + this.groupID + "StaleUsers").find(function(error, response){
		callback(error, response);
 	});     
}


/**
 * messageStaleUsers method
 *
 * Sends Messages to all stale users stored in the database and updates their warned boolean.
 *
 * message 			- String, warning message to be sent to stale users
 * warned 			- Boolean, true - stored stale users are flagged as warned
 * callback 		- callback, returns the last error from the multi update or the success response
 */
StaleUsers.prototype.messageStaleUsers = function(message, warned, callback) {
	// Maintain Scipe
	var self = this;

	// Instantiate Stale Users List
	var staleUsers = [];
	
	// Retrieve Stale User List and Message
	this.db.collection("Group" + this.groupID + "StaleUsers").find(function(error, response){
		if(!error || error.length == 0 && response){
			staleUsers = response;
	    	MembershipUtilities.directMessageMembers(self.accessToken, staleUsers, message, function(error, response){
	    		if(!error || error.length < staleUsers.length){
	    			// updates warned boolean
				    self.db.collection("Group" + self.groupID + "StaleUsers").update(
				    	{ 
				    		'warned': false
				    	},
				   		{
				      		$set: { 'warned': warned }
				   		},
				   		{ 
				   			'multi': true 
				   		}, function(error, response){
				   		// If the response is successful, log the successful update
				        if(!error || error.length == 0){
				        	if(response > 0){
				            	console.log("\033[92m" + response + "Warned Booleans Updated Successfully\033[0m");
				            } else {
				            	console.log("\033[93mNo Warned Booleans Updated\033[0m");
				            }
							callback(null, response);
				        } 
				        // If the update failed log it.
				        else{
				            console.log("\033[1;31mWarned Boolean Updates Error\033[0m");
				            callback(error, response);
				        }
				   	});	 
	    		} else {
            		callback(error, response);
            	}
	    	});
        } else {
            callback(error, response);
        }
 	});     
}


/**
 * removeStaleUsers method
 *
 * Removes all stale users from the group whose warned boolean is set to true, then updates the database.
 *
 * ignoreWarned 	- Boolean, [Optional] Ignores the warned boolean and removes all stale members
 * callback 		- callback, returns the last error from the bulk insert or the success response
 */
StaleUsers.prototype.removeStaleUsers = function(ignoreWarned, callback) {
	// Maintain Scipe
	var self = this;

	// Handle ignoreWarned Parameter
	if(arguments.length == 2 && ignoreWarned == true){
		var params = {};
	} else {
		if (Object.prototype.toString.call(ignoreWarned) == "[object Function]") {
      		callback = ignoreWarned; 
    	}
		var params = {'warned': true}
	}

    // Retrieves the list of Stale users from the DB
	this.db.collection("Group" + this.groupID + "StaleUsers").find(params, function(error, response){
		if(!error || error.length == 0 && response){
			staleUsers = response;
	    	MembershipUtilities.removeMembers(self.accessToken, staleUsers, self.groupID, function(error, response){
	    		if(!error || error.length < staleUsers.length){
	    			// Removes Users
				    self.db.collection("Group" + self.groupID + "StaleUsers").remove(params, function(error, response){
				   		// If the response is successful, log the successful removal
				        if(!error || error.length == 0){
				            if(response > 0){
				            	console.log("\033[92m" + response + " Stale User Removed Successfully\033[0m");
				            } else {
				            	console.log("\033[93mNo Users Removed\033[0m");
				            }
							callback(null, response);
				        } 
				        // If the removal failed log it.
				        else{
				            console.log("\033[1;31mStale User Removal Error\033[0m");
				            callback(error, response);
				        }
				   	});	 
	    		} else {
            		callback(error, response);
            	}
	    	});
        } else {
            callback(error, response);
        }
 	});     
}


/************************************************************************
 * Export Functions to be Used by Node.
 ***********************************************************************/

module.exports = StaleUsers;