
/************************************************************************
 * External Dependencies 
 ***********************************************************************/

var GroupMe 		= require('groupme');
var API 			= GroupMe.Stateless;

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
var Memberships = function(ACCESS_TOKEN) {
	this.accessToken = ACCESS_TOKEN;
}


/**
 * transferMembers function
 *
 * Transfers all unique members from one group to another group
 *
 * fromGroup		- String, ID for the group where members are to be transfered from
 * toGroup 			- String, ID for the group where members are to be transfered to
 * callback 		- callback, returns errors and responses while transfering members
 */
Memberships.prototype.transferMembers = function(fromGroup, toGroup, callback){
	// Maintain Scope
	var self = this;

	// Grab Member Lists
	this.getMembers(fromGroup, toGroup, function(error, response){
		if (!error || error.length == 0 && response) {
			var uniqueMembers = response["toAddList"];
			
			// Add Unique Members
			self.addMembers(uniqueMembers, toGroup, function(error, response){
				if (!error || error.length == 0 && response) {
					callback(null, response);
				} else {
					callback(error);
				}	
					});
		} else{
			callback(error);
		}
	});
}



/**
 * getMembers function
 *
 * Gathers roster of both groups and returns inner and outer unique groups
 *
 * fromGroup		- String, ID for the group where members are to be transfered from
 * toGroup 			- String, ID for the group where members are to be transfered to
 * callback 		- callback, returns all unique member groups, along with any errors
 */
Memberships.prototype.getMembers = function(fromGroup, toGroup, callback) {
	// Maintain Scope
	var self 			= this;

	// Member lists.
	var fromMemberList	= [];
	var toMemberList 	= [];

	// Callbacks
	var responses		= [];
	var errors 			= [];
	var callbackCount 	= 2;


	// Gather Roster And Return Unique Member Groups
	this.gatherRoster(fromGroup, function(error, response) {
		if (!error || error.length == 0 && response) {
			fromMemberList = response;
		} else {
			errors.push(error);
		}
		callbackCount--;
		if(callbackCount == 0){
			callback(errors, self.memberGroups(fromMemberList, toMemberList));
		}
	});

	this.gatherRoster(toGroup, function(error, response) {
		if (!error || error.length == 0 && response) {
			toMemberList = response;
		} else {
			errors.push(error);
		}
		callbackCount--;
		if(callbackCount == 0){
			callback(errors, self.memberGroups(fromMemberList, toMemberList));
		}
	});
}


/**
 * gatherRoster function
 *
 * Sends a Get request to GroupMe API to gather and return an array of all group members from groupID
 *
 * groupID			- String, ID for the group whose members are to be retrieved
 * callback 		- callback, returns all members from group with groupID along with any errors
 */
Memberships.prototype.gatherRoster = function(groupID, callback) {
	// Maintain Scope
	var self = this;

	// Make API Call
	API.Groups.show(
		self.accessToken,
		groupID,
		function(error, response) {
			if (!error || error.length == 0 && response) {
				callback(null, response.members);
			} else {
				callback("Group Show Error");
			}
		}
	);
}


/**
 * memberGroups function
 *
 * Processes the roster of both groups and returns a dictionary of inner and outer unique members
 *
 * fromGroup		- String, ID for the group where members are to be transfered from
 * toGroup 			- String, ID for the group where members are to be transfered to
 *
 * return 			: Dictionary, containing arrays of inner and outer unique members
 */
// Call only after populating list of old and new members
Memberships.prototype.memberGroups = function(fromGroup, toGroup) {
	if ( fromGroup != null && toGroup != null){	
	
		// Member Lists
		var fromAddList 	= [];
		var toAddList		= [];
		var fromDeleteList	= [];
		var toDeleteList	= [];

		// Member Dictionaries
		var fromDict		= {};
		var toDict 			= {};
		var memberGroups 	= {};


		// Process Group Rosters
		for(var i = 0, len = fromGroup.length; i < len; i++) {
			// Populate Dictionaries
			fromDict[fromGroup[i].user_id] = fromGroup[i].nickname;

			//delete fromGroup[i].id;
			delete fromGroup[i].image_url;
			delete fromGroup[i].muted;
			delete fromGroup[i].autokicked;
		}

		for(var i = 0, len = toGroup.length; i < len; i++) {
			// Populate Dictionaries
			toDict[toGroup[i].user_id] = toGroup[i].nickname;

			//delete toGroup[i].id;
			delete toGroup[i].image_url;
			delete toGroup[i].muted;
			delete toGroup[i].autokicked;
		}


		// Populate Member Lists
		for(var i = 0, len = fromGroup.length; i < len; i++) {
			if(toDict[fromGroup[i].user_id] == null){
				toAddList.push(fromGroup[i]);
				fromDeleteList.push(fromGroup[i]);
			}
		}

		for(var i = 0, len = toGroup.length; i < len; i++) {
			if(fromDict[toGroup[i].user_id] == null){
				fromAddList.push(toGroup[i]);
				toDeleteList.push(toGroup[i]);
			}
		}


		// Populate Member Groups
		memberGroups["fromAddList"]		= fromAddList;
		memberGroups["toAddList"]		= toAddList;
		memberGroups["fromDeleteList"]	= fromDeleteList;
		memberGroups["toDeleteList"]	= toDeleteList;


		// Return Member Groups
		return memberGroups;

	} else {
		return null;
	}

}

/**
 * AddMembers function
 *
 * Sends a POST request to GroupMe API adding all members from memberList to the specified group
 *
 * memberList		- Array, containg IDs of members to be added to the group
 * groupID 			- String, ID for the group where members are to be added to
 * callback 		- callback, returns any errors or responses from the request
 */
Memberships.prototype.addMembers = function(memberList, groupID, callback){
	// Maintain Scope
	var self = this;

	// Check for Members
	if(memberList.length > 0){
		
		// Create Key Value Object
		var output = {};
		output['members'] = memberList;

		// Make API Call
		API.Members.add(
			self.accessToken,
			groupID,
			output,
			function(error, response) {
				if(!error || error.length == 0 && response) {
					callback(null, "Members Added");
				} else {
					callback("Member Add Error");
				}
			}
		);
	} else {
		callback("Add List Empty");
	}
}





/**
 * removeMembers function
 *
 * Sends a POST request to GroupMe API for each member to be removed from the specified group
 *
 * memberList		- Array, containg IDs of members to be removed to the group
 * groupID 			- String, ID for the group where members are to be removed from
 * callback 		- callback, returns any errors or responses from the request
 */
Memberships.prototype.removeMembers = function(memberList, groupID, callback){
	// Maintain Scope
	var self = this;

	// removeCall function to maintain object scope
	var removeCall = function(memberObject, callback){
		// API call to remove the member
		API.Members.remove(
			self.accessToken,
			groupID,
			memberObject.id,
			function(error, response) {
				if(!error || error.length == 0 && response) {
					Console.log("\033[93m"+ memberObject.name + "Deleted (id: " + memberObject.id + ", user_id: " + memberObject.user_id + ")\033[0m");
					callback(null, memberObject);
				} else {
					callback("Member Delete Error");
				}
			}
		);
	}
	// Check for Members
	if(memberList.length > 0){
		
		// Loop through every member
		var callbackCount	= 0;
		var errors 			= [];
		var responses 		= [];

		for(member in memberList){
			callbackCount++;
			removeCall(member, function(error, response){
				if(!error || error.length == 0 && response) {
					responses.push(response);
				} else {
					errors.push(error);
				}
				if(callbackCount == 0){
					callback(errors, responses);
				}	
			});
		}
	} else {
		callback("Delete List Empty");
	}
}

/************************************************************************
 * Utilities Containers
 ***********************************************************************/

// All the functions take the form function(options,callback);
// and all callbacks take the form function(err,returnval);
MembershipUtilities               	= {};
MembershipUtilities.transferMembers = {};
MembershipUtilities.bindMembership	= {};
MembershipUtilities.addMembers		= {};
MembershipUtilities.removeMembers	= {};
MembershipUtilities.blockMembers	= {};


/************************************************************************
 * Exported Utility Functions
 ***********************************************************************/


/**
 * MembershipUtilities transferMembers method
 *
 * Exported method to run transferMessages prototype function of Memberships function
 *
 * ACCESS_TOKEN		- String, personal access token for GroupMe API
 * fromGroup		- String, ID for the group where members are to be transfered from
 * toGroup 			- String, ID for the group where members are to be transfered to
 * callback 		- callback, returns errors and responses from transferring members
 */
MembershipUtilities.transferMembers = function(ACCESS_TOKEN, FROM_GROUP, TO_GROUP, callback) {
	var transferMembers = new Memberships(ACCESS_TOKEN);
	transferMembers.transferMembers(FROM_GROUP, TO_GROUP, function(error, response){
		if(!error || error.length == 0 && response){
			callback(null, response);
		} else {
			callback(error);
		}
	});
}


/**
 * AddMembers function
 *
 * Sends a POST request to GroupMe API adding all members from memberList to the specified group
 *
 * ACCESS_TOKEN		- String, personal access token for GroupMe API
 * memberList		- Array, containg IDs of members to be added to the group
 * groupID 			- String, ID for the group where members are to be added to
 * callback 		- callback, returns any errors or responses from the request
 */
MembershipUtilities.addMembers = function(ACCESS_TOKEN, member_list, group_ID, callback) {
	var transferMembers = new Memberships(ACCESS_TOKEN);
	transferMembers.addMembers(member_list, group_ID, function(error, response){
		if(!error || error.length == 0 && response){
			callback(null, response);
		} else {
			callback(error);
		}
	});	
}


/**
 * removeMembers function
 *
 * Sends a POST request to GroupMe API for each member to be removed from the specified group
 *
 * ACCESS_TOKEN		- String, personal access token for GroupMe API
 * memberList		- Array, containg IDs of members to be removed to the group
 * groupID 			- String, ID for the group where members are to be removed from
 * callback 		- callback, returns any errors or responses from the request
 */
MembershipUtilities.removeMembers = function(ACCESS_TOKEN, member_list, group_ID, callback) {
	var transferMembers = new Memberships(ACCESS_TOKEN);
	transferMembers.removeMembers(member_list, group_ID, function(error, response){
		if(!error || error.length == 0 && response){
			callback(null, response);
		} else {
			callback(error);
		}
	});	
}



/************************************************************************
 * Run from the command line
 ***********************************************************************/


/**
 * Command line arguments. 
 */
var ACCESS_TOKEN 	= process.argv[2];
var FROM_GROUP 		= process.argv[3];
var TO_GROUP 		= process.argv[4];


/**
 * Tranfer members from the command line.
 */
if(require.main === module){
	MembershipUtilities.transferMembers(ACCESS_TOKEN, FROM_GROUP, TO_GROUP, function(error, response){
	    if(!error || error.length == 0){
	        console.log("\033[92mSuccess\033[0m");
	        console.log(response);
	        process.exit(code = 0);
	    }else{
	        console.log("\033[1;31mFailure\033[0m");
	        console.log(error);
	        process.exit(code = 1);
	    }
	});
}

/**
 * Export functions to be used by node.
 */
module.exports = MembershipUtilities;