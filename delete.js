var GroupMe = require('groupme');
var API = require('groupme').Stateless;

API.Members.remove(
	'c74e9900384b013104357e620898ea29',
	'6566120',
	'34062876',
	function(error, response) {
		if(!error && response) {
			console.log(response);
		} else {
			console.log(error);
		}
	}
);