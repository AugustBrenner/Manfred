
/************************************************************************
 * External Dependencies 
 ***********************************************************************/

var GroupMe 		= require('groupme');
var API 			= GroupMe.Stateless;
var mongojs 		= require('mongojs');
var Compiler   		= require('./MessageCompiler');

/************************************************************************
 * Membership Managing Functions
 ***********************************************************************/


/**
 * History function
 *
 * Stored Access_Token value for use by prototype functions
 *
 * ACCESS_TOKEN		- String, personal access token for GroupMe API
 */
var History = function(ACCESS_TOKEN, GROUP_ID, DATABASE_URL) {
	
	// Set Access Token
	this.accessToken = ACCESS_TOKEN;
	this.groupID = GROUP_ID;

	// Connect to Database if Passed DATABASE_URL
	if(DATABASE_URL){
		this.databaseURL = DATABASE_URL;
		
		// Set Database Collections
		var collections = [
		    "Group" + this.groupID + "Messages", 
		    "Group" + this.groupID + "BlockList", 
		    "Group" + this.groupID + "PendingRemoval"
		];

		// Connect to Database    
	    this.db = mongojs.connect(this.databaseURL, collections);
	}
}

History.prototype.postedWithin = function(time){
	
	// Time Object Converted to Seconds
	var seconds = toSeconds(time);
	// Current Time Since Epoch
	var currentTime = new Date().getTime();
	// Working Date
	var workingDate = currentTime - seconds;
}

/**
 * compileMessages function
 *
 * Utilizes the MessageCompiler.js module to store the complete message history of a GroupMe
 * group into a mongoDB
 *
 * callback 		- callback, returns any errors or responses from the request
 */
History.prototype.compileMessages = function(callback){

	Compiler.getMessages(this.accessToken, groupID, this.databaseURL, function(error, response){
		if (!error || error.length == 0 && response) {
			callback(null, response);
		} else {
			callback(error);
		}
	});
}


/************************************************************************
 * Helper Functions
 ***********************************************************************/


History.prototype.callDB = function(table, memberList, fromDate, toDate, count, insert, remove, callback){
	
	// Construct Query:

	// Initial Query Command
	var query = this.db.collection("Group" + this.groupID + table);
	
	var queryDB = function(memberObject, callback){
		// Build find() Object:

		// Stores search criteria
		var findObject = {};
		findObject['$and'] = [];

		// Add Search Criteria		
		if(memberObject.user_id)
			findObject['$and'].push({user_id: memberObject.user_id});
		if(fromDate && fromDate > 0)
			findObject['$and'].push({created_at: { $gt: fromDate}});
		if(toDate && toDate > 0)
			findObject['$and'].push({created_at: { $lt: toDate}});

		// Handle Insert, Remove, and Count
		if(count){
			query = query.find(findObject).count(function(error, response){
				if (!error || error.length == 0 && response) {
					callback(null, response);
				} else {
					callback(error);
				}
			});
		}else if(insert){
			query = query.insert(memberObject, function(error, response){
				if (!error || error.length == 0 && response) {
					callback(null, response);
				} else {
					callback(error);
				}
			});
		} else if(remove){
			query = query.remove(memberObject, function(error, response){
				if (!error || error.length == 0 && response) {
					callback(null, response);
				} else {
					callback(error);
				}
			});
		} else {
			query = query.find(findObject, function(error, response){
				if (!error || error.length == 0 && response) {
					callback(null, response);
				} else {
					callback(error);
				}
			});		
		}
	}

	if(memberList && memberList.length > 0){
		// Process memberList
		this.forAll(memberList, queryDB, function(error, response){
			if(error || error.length == 0 && response){
				callback(null, response);
			} else {
				callback(error);
			}
		});
	} else {
		queryDB(null, function(error, response){
			if(error || error.length == 0 && response){
				callback(null, response);
			} else {
				callback(error);
			}
		});
	}
}


/**
 * forAll function
 *
 * Sends API calls for each member of a memberList
 *
 * memberList		- Array, containg IDs of members to be removed to the group
 * asyncFunction 	- function, directly utilizes the API
 * callback 		- callback, returns all errors and responses of the API calls
 */
History.prototype.forAll = function(memberList, asyncFunction, callback){
	
	// Check for Members
	if(memberList.length > 0){
		
		// Loop through every member
		var callbackCount	= 0;
		var errors 			= [];
		var responses 		= [];

		for(var i = 0, len = memberList.length; i < len; i++){
			
			// Increment CallbackCount
			callbackCount++;

			// Activate Passed function
			asyncFunction(memberList[i], function(error, response){
				if(!error || error.length == 0 && response) {
					responses.push(response);
				} else {
					errors.push(error);
				}

				// Decriment Callback Count on Callback
				callbackCount--;

				// Return Callback
				if(callbackCount == 0){
					callback(errors, responses);
				}	
			});
		}
	} else {
		callback("List Empty");
	}	
}

var toSeconds = function(time){

	// Seconds Variable
 	var seconds = 0

 	// Convert to Seconds
	if(time.seconds && time.seconds > 0)
		seconds += time.seconds;
	if(time.minutes && time.minutes > 0)
		seconds += (time.minutes * 60);
	if(time.hours && time.hours > 0)
		seconds += (time.hours * 60 * 60);
	if(time.days && time.days > 0)
		seconds += (time.days * 60 * 60 * 24);
	if(time.weeks && time.weeks > 0)
		seconds += (time.weeks * 60 * 60 * 24 * 7);
	if(time.months && time.months > 0)
		seconds += (time.months * 60 * 60 * 24 * 30);
	if(time.years && time.years > 0)
		seconds += (time.years * 60 * 60 * 24 * 365);

	// Return Seconds
	return seconds;
}




/************************************************************************
 * Utilities Containers
 ***********************************************************************/

// All the functions take the form function(options,callback);
// and all callbacks take the form function(err,returnval);
HistoryUtilities = {};


/************************************************************************
 * Exported Utility Functions
 ***********************************************************************/

/**
 * compileMessages function
 *
 * Utilizes the MessageCompiler.js module to store the complete message history of a GroupMe
 * group into a mongoDB
 *
 * ACCESS_TOKEN		- String, personal access token for GroupMe API
 * GROUP_ID 		- String, ID for the group where members are to be added to
 * DATABASE_URL 	- String, URL of the database used to store message history
 * callback 		- callback, returns any errors or responses from the request
 */
HistoryUtilities.compileMessages = function(ACCESS_TOKEN, GROUP_ID, DATABASE_URL, callback) {
	var memberships = new History(ACCESS_TOKEN, GROUP_ID, DATABASE_URL);
	memberships.compileMessages(function(error, response){
		if(!error || error.length == 0 && response){
			callback(null, response);
		} else {
			callback(error);
		}
	});
}

HistoryUtilities.insert = function(ACCESS_TOKEN, GROUP_ID, DATABASE_URL, table, memberList, fromDate, toDate, count, insert, update, callback) {
	var memberships = new History(ACCESS_TOKEN, GROUP_ID, DATABASE_URL);
	memberships.callDB(table, memberList, fromDate, toDate, count, insert, update, function(error, response){
		if(!error || error.length == 0 && response){
			callback(null, response);
		} else {
			callback(error);
		}
	});
}


/************************************************************************
 * Export Functions to be Used by Node.
 ***********************************************************************/

module.exports = HistoryUtilities;