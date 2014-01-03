
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
 * GROUP_ID 		- String, ID for the group whose data is to be accessed
 * DATABASE_URL		- String, the URL to the database for persistant storage
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

	// Database Access Commands:
	// Instantiate DB criteria

		this.table 			= null;
		this.memberList 	= null;
		this.afterDate 		= null;
		this.beforeDate 	= null;
		this.isCount 		= false;
		this.isInsert 		= false;
		this.isRemove 		= false;

	
	/****************************
	 * Database Access Functions
	 ****************************/
	this.messages = function(){
		this.table = "Messages";
		return this;
	}
	this.from = function(memberList){
		this.memberList = memberList;
		return this; 
	}
	this.after = function(afterDate){
		this.afterDate = afterDate;
		return this;
	}
	this.before = function(beforeDate){
		this.beforeDate = beforeDate;
		return this;
	}
	this.find = function(callback){
		this.call(function(error,response){
			callback(error, response);
		});
	}
	this.count = function(callback){
		this.isCount = true;
		this.call(function(response){
			callback(error, response);
		});
	}
	this.insert = function(callback){
		this.isInsert = true;
		this.call(function(response){
			callback(error, response);
		});
	}
	this.remove = function(callback){
		this.isRemove = true;
		this.call(function(response){
			callback(error, response);
		});
	}
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
		callback(errors, response);
	});
}


/************************************************************************
 * Helper Functions
 ***********************************************************************/


/**
 * call function
 *
 * calls the callDB function with the Prototype object values as perameters
 *
 * callback 		- callback, returns all errors and responses of the API calls
 */
History.prototype.call = function(callback){
	this.callDB(
		this.table,
		this.memberList,
		this.afterDate,
		this.beforeDate,
		this.isCount,
		this.isInsert,
		this.isRemove,
		function(error, response){
			if (!error || error.length == 0 && response) {
				callback(null, response);
			} else {
				callback(error);
			}			
		}
	);
}


/**
 * callDB function
 *
 * Consructs and sends one or more API calls to the MongoDB database
 *
 * table 			- String, the collection in the database to be accessed
 * memberList		- Array, containg IDs of members to be removed to the group
 * afterDate 		- Timestamp, the date after which to return values
 * beforeDate 		- Timestamp, the date before which to return values
 * isCount 			- Boolean, if true returns the count of objects queried
 * isInsert 		- Boolean, if true inserts the object passed
 * isRemove 		- Boolean, if true removes the object passed
 * callback 		- callback, returns all errors and responses of the API calls
 */
History.prototype.callDB = function(table, memberList, afterDate, beforeDate, isCount, isInsert, isRemove, callback){
	
	// Construct Query:
	// Initial Query Command
	var query = this.db.collection("Group" + this.groupID + table);
	
	var queryDB = function(memberObject, callback){
		// Build find() Object:

		// Stores search criteria
		var findObject = {};
		if(memberObject && memberObject.user_id || afterDate || beforeDate)
			findObject['$and'] = [];

		// Add Search Criteria		
		if(memberObject && memberObject.user_id)
			findObject['$and'].push({user_id: memberObject.user_id});
		if(afterDate && afterDate > 0)
			findObject['$and'].push({created_at: { $gt: afterDate}});
		if(beforeDate && beforeDate > 0)
			findObject['$and'].push({created_at: { $lt: beforeDate}});

		// Handle Insert, Remove, and Count
		if(isCount){
			query = query.find(findObject).count(function(error, response){
				callback(error, response);
			});
		}else if(isInsert){
			query = query.insert(memberObject, function(error, response){
				callback(error, response);
			});
		} else if(isRemove){
			query = query.remove(memberObject, function(error, response){
				callback(error, response);
			});
		} else {
			query = query.find(findObject, function(error, response){
				callback(error, response);
			});		
		}
	}

	if(memberList && memberList.length > 0){
		// Process memberList
		forAll(memberList, queryDB, function(error, response){
			callback(error, response);
		});
	} else {
		queryDB(null, function(error, response){
			callback(error, response);
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
var forAll = function(memberList, asyncFunction, callback){
	
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


/**
 * toSeconds function
 *
 * converts a time object to seconds
 *
 * time			- Object, representing a time
 *					{seconds: 	int}
 *					{minutes: 	int}
 *					{hours: 	int}
 *					{days: 		int}
 *					{weeks: 	int}
 *					{months: 	int}
 *					{years: 	int}
 *
 * return 		:The value of the time object in seconds
 */
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
		callback(error, response);
	});
}

HistoryUtilities.insert = function(ACCESS_TOKEN, GROUP_ID, DATABASE_URL, table, memberList, afterDate, beforeDate, isCount, insert, update, callback) {
	var memberships = new History(ACCESS_TOKEN, GROUP_ID, DATABASE_URL);
	memberships.callDB(table, memberList, afterDate, beforeDate, isCount, insert, update, function(error, response){
		callback(error, response);
	});
}

HistoryUtilities.find = function(ACCESS_TOKEN, GROUP_ID, DATABASE_URL, callback) {
	var memberships = new History(ACCESS_TOKEN, GROUP_ID, DATABASE_URL);
	memberships.messages().from([{user_id : '7232613'}]).before(1385486016).find(function(error, response){
		callback(error, response);
	});
}


/************************************************************************
 * Export Functions to be Used by Node.
 ***********************************************************************/

module.exports = HistoryUtilities;