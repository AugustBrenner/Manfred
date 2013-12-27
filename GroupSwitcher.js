
/**
 * Module dependencies.
 */
var GroupMe 		= require('groupme');
var API 			= GroupMe.Stateless;


/**
 * Command line arguments. 
 */
var ACCESS_TOKEN 	= process.argv[2];
var FROM_GROUP 		= process.argv[3];
var TO_GROUP 		= process.argv[4];


/**
 * Prepare functions for export. 
 */
GroupSwitcher               	= {};
GroupSwitcher.transferMembers   = {};
GroupSwitcher.bindMembership	= {};



var TransferMembers = function() {
	this.oldMembers;
	this.newMembers;
	this.secondGroup = false;
	this.fromGroupRoster	= {};
	this.toGroupRoster		= {};
}


TransferMembers.prototype.transferMembers = function(fromGroup, toGroup, callback){
	// Maintain Scope
	var self = this;

	// Grab Member Lists
	this.getMembers(fromGroup, toGroup, function(error, response){
		if (!error || error.length == 0 && response) {
			var uniqueMembers = response["toAddList"];
			
			// Add Unique Members
			self.addMembers(uniqueMembers, toGroup, function(error, response){
				if (!error && response) {
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


TransferMembers.prototype.getMembers = function(fromGroup, toGroup, callback) {
	// Maintain Scope
	var self 			= this;

	// Member lists.
	var fromMemberList	= [];
	var toMemberList 	= [];

	// Callbacks
	var responses		= [];
	var errors 			= [];
	var callbackCount 	= 2;

	this.gatherRoster(fromGroup, function(error, response) {
		if (!error && response) {
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
		if (!error && response) {
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


TransferMembers.prototype.gatherRoster = function(groupID, callback) {
	var self = this;
	API.Groups.show(
		ACCESS_TOKEN,
		groupID,
		function(error, response) {
			if (!error && response) {
				callback(null, response.members);
			} else {
				callback("Group Show Error");
				console.log("Group Show Error");
			}
		}
	);
}


/*

TransferMembers.prototype.gatherRoster = function(groupID, callback) {
	var self = this;
	API.Groups.show(
		ACCESS_TOKEN,
		groupID,
		function(error, response) {
			if (!error && response) {
				if( self.secondGroup == false) {
					self.newMembers = response.members;
					self.secondGroup = true;
					self.gatherRoster(TO_GROUP);
				} else {
					self.oldMembers = response.members;
					self.addUnique();
				}
				
			} else {
				console.log("Group Show Error");
			}
		}
	);
}

*/

// Call only after populating list of old and new members
TransferMembers.prototype.memberGroups = function(fromGroup, toGroup) {
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


TransferMembers.prototype.addMembers = function(memberList, groupID, callback){
	if(memberList.length > 0){
		
		var output = {};
		output['members'] = memberList;

		API.Members.add(
			ACCESS_TOKEN,
			groupID,
			output,
			function(error, response) {
				if(!error && response) {
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

/*
TransferMembers.prototype.deleteMembers = function(memberList, groupID, callback){
	if(memberList.length > 0){
		
		var output = {};
		output['members'] = memberList;

		API.Members.add(
			ACCESS_TOKEN,
			groupID,
			output,
			function(error, response) {
				if(!error && response) {
					Console.log("Members Deleted");
					callback(null, "Members Deleted");
				} else {
					console.log("Member Delete Error");
					callback("Member Delete Error");
				}
			}
		);
	} else {
		callback("Delete List Empty");
	}
}

*/

GroupSwitcher.transferMembers = function(ACCESS_TOKEN, FROM_GROUP, TO_GROUP, callback) {
	var transferMembers = new TransferMembers;
	transferMembers.transferMembers(FROM_GROUP, TO_GROUP, function(error, response){
		if(!error && response){
			callback(null, response);
		} else {
			callback(error);
		}
	});
}


/**
 * Tranfer members from the command line.
 */
GroupSwitcher.transferMembers(ACCESS_TOKEN, FROM_GROUP, TO_GROUP, function(error, response){
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
module.exports = GroupSwitcher;