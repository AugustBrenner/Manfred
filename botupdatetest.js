var GroupMe             = require('groupme');
var API                 = require('groupme').Stateless;



API.Bots.update(
	'c74e9900384b013104357e620898ea29',
	'30ff5f0e8fa6c9df115deedecc',
	{name : "hello", },
	function(error, response) {
		if (!error && response) {
			console.log(response);		
		} else {
			console.log("modification error");
		}
	}
);