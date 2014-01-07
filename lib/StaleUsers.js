
/************************************************************************
 * External Dependencies 
 ***********************************************************************/

var mongojs 			= require('mongojs');
var GroupMeAdmin		= require('./groupme-admin')
var HistoryUtilities   	= GroupMeAdmin.HistoryUtilities;
var MembershipUtilities	= GroupMeAdmin.MembershipUtilities;


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
 */
var StaleUsers = function(ACCESS_TOKEN, GROUP_ID, DATABASE_URL) {
	
	// Set Access Token
	this.accessToken = ACCESS_TOKEN;
	this.groupID = GROUP_ID;

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
 * compileMessages function
 *
 * Utilizes the MessageCompiler.js module to store the complete message history of a GroupMe
 * group into a mongoDB
 *
 * callback 		- callback, returns any errors or responses from the request
 */



/************************************************************************
 * Export Functions to be Used by Node.
 ***********************************************************************/

module.exports = StaleUsers;