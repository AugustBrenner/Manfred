
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


TransferMembers.prototype.getMembers = function(fromGroup, toGroup, callback) {

	// Member lists.
	var fromMemberList	= [];
	var toMemberList 	= [];

	// Callbacks
	var responses		= [];
	var errors 			= [];
	var callbackCount 	= 2;

	// Populate Member Groups
	var getMemberGroups = function(){
		this.memberGroups(fromMemberList, toMemberList, function(error, response){
			if(!error && response){
				callback(response);
			} else{
				errors.push(error);
				callback(errors);
			}
		});
	}


	this.gatherRoster(fromGroup, function(error, response) {
		if (!error && response) {
			fromMemberList = response;
		} else {
			errors.push(error);
		}
		callbackCount--;
		if(callbackCount == 0){
			getMembers();
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
			getMembers();
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
TransferMembers.prototype.addUnique = function() {
	var hashDictionary = {};
	var addList = new Array();
	for(var i = 0, len = this.oldMembers.length; i < len; i++) {
		hashDictionary[this.oldMembers[i].user_id] = this.oldMembers[i].nickname;
	}
	for(var i = 0, len = this.newMembers.length; i < len; i++) {
		if(hashDictionary[this.newMembers[i].user_id] == null) {
			delete this.newMembers[i].id;
			delete this.newMembers[i].image_url;
			delete this.newMembers[i].muted;
			delete this.newMembers[i].autokicked;
			addList.push(this.newMembers[i]);
		}
	}
	if(addList.length > 0){
		var output = {};
		output['members'] = addList;

		API.Members.add(
			ACCESS_TOKEN,
			TO_GROUP,
			output,
			function(error, response) {
				if(!error && response) {
					console.log(response);
				} else {
					console.log("Member Add Error");
				}
			}
		);
	}
}


var transferMembers = new TransferMembers;
transferMembers.gatherRoster(FROM_GROUP);



/**
 * Export functions to be used by node.
 */
module.exports = GroupSwitcher;