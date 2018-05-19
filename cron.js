const http = require('http');
const port = 8080;

function cron_assemble() {
  console.log("assembling packets");
};

function cron_take_picture() {
  console.log("taking pictures");
};

const requestHandler = (request, response) => {
  console.log(request.url)
  if(request.url.startsWith('/cron/assemble')) {
    cron_assemble();
    response.end(JSON.stringify({"cron": "assemble"}));
  } else if(request.url.startsWith('/cron/take-picture')) {
    cron_take_picture();
    response.end(JSON.stringify({"cron": "take-picture"}));
  } else if(request.url.startsWith('/readiness_check')) {
    response.end();
  } else if (request.url.startsWith('/liveness_check')) {
    response.end();
  } else {
    response.end(JSON.stringify({"error": "unsupported"}));
  }
}

http
.createServer(requestHandler)
.listen(port, function(req, res){
  console.log("listening on port " + port);
});
