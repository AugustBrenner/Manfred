
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
 * Memberships function
 *
 * Stored Access_Token value for use by prototype functions
 *
 * ACCESS_TOKEN		- String, personal access token for GroupMe API
 */
var Memberships = function(ACCESS_TOKEN, DATABASE_URL) {
	
	// Set Access Token
	this.accessToken = ACCESS_TOKEN;

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



Memberships.prototype.compileMessages = function(groupID, callback){

	Compiler.getMessages(this.accessToken, groupID, this.databaseURL, function(error, response){
		if (!error || error.length == 0 && response) {
			callback(null, response);
		} else {
			callback(error);
		}
	});
}



/************************************************************************
 * Utilities Containers
 ***********************************************************************/

// All the functions take the form function(options,callback);
// and all callbacks take the form function(err,returnval);
MembershipUtilities               	= {};


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
 * MEMBER_LIST		- Array, containg IDs of members to be added to the group
 * GROUP_ID 		- String, ID for the group where members are to be added to
 * DATABASE_URL 	- String, URL of the database used to store message history
 * callback 		- callback, returns any errors or responses from the request
 */
MembershipUtilities.compileMessages = function(ACCESS_TOKEN, GROUP_ID, DATABASE_URL, callback) {
	var memberships = new Memberships(ACCESS_TOKEN, DATABASE_URL);
	memberships.compileMessages(GROUP_ID, function(error, response){
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

module.exports = MembershipUtilities;