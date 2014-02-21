
/************************************************************************
 * External Dependencies 
 ***********************************************************************/

var GroupMe 			= require('groupme');
var API 				= GroupMe.Stateless;
var mongojs 			= require('mongojs');
var HistoryUtilities	= require('./HistoryUtilities');



/************************************************************************
 * Utilities Containers
 ***********************************************************************/

// All the functions take the form function(options,callback);
// and all callbacks take the form function(error,return);

/**
 * GameUtilities function
 *
 * Connects to the database and sets ACCESS_TOKEN and GROUP_ID
 *
 * ACCESS_TOKEN		- String, personal access token for GroupMe API
 * GROUP_ID 		- String, ID for the group where members are to be added to
 * DATABASE_URL 	- String, URL of the database used to store message history
 */
var GameUtilities = function(ACCESS_TOKEN, GROUP_ID, DATABASE_URL){
	this.accessToken 	= ACCESS_TOKEN;
	this.groupID 		= GROUP_ID;
	this.databaseURL 	= DATABASE_URL;
};


/************************************************************************
 * Exported Utility Functions
 ***********************************************************************/


/**
 * postedBy function
 *
 * Retrieves messages posted by a specific user
 *
 * userID 			- String, user_id of the person posting messages
 * callback 		- callback, returns an array of messages from the user
 *
 * TODO: 			Add memory limit exception handling for very large arrays,
 * 		 			Add from and to date ranges.
 */
GameUtilities.prototype.returnRandomMessageBy = function(username, callback){
	var history = new HistoryUtilities(this.accessToken, this.groupID, this.databaseURL);
	history.getMessagesBy(username, function(error, response){
		if(!error && response.length > 0){
			var i = Math.round(Math.random() * response.length - 1);
			callback(null, response[i]);
		} else{
			callback(error, response);
		}
	});	
}


/************************************************************************
 * Export Functions to be Used by Node.
 ***********************************************************************/

module.exports = GameUtilities;