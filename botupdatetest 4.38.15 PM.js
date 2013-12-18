var GroupMe             = require('groupme');
var API                 = require('groupme').Stateless;



API.Bots.update(
	'c74e9900384b013104357e620898ea29',
	'4acf5180d9b3ae623a8f4bbc0e',
	{name: "gother", avatar_url: "http://i.groupme.com/98b57da034630131b8ce12313b12cc51"},
	function(error, response) {
		if (!error && response) {
			console.log(response);		
		} else {
			console.log("error");
		}
	}
);


/*API.Bots.create(
	'c74e9900384b013104357e620898ea29',
	"manfred",
	"6566120",
	function(error, response) {
		if (!error && response) {
			console.log(response);		
		} else {
			console.log("error");
		}
	}
);*/