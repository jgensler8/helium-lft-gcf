const index = require('./index');
const http = require('http');
const port = 8080;

const configuration = require('./configuration.json')
const CLOUD_REGION = configuration["CLOUD_REGION"];
const REGISTRY_ID = configuration["REGISTRY_ID"];
const DEVICE_ID = configuration["DEVICE_ID"];

function cron_assemble() {
  console.log("assembling packets");
  // list images in directory
  
  // list unique transaction ids
  
  // assemble transactions ids that are not in images
};

function cron_take_picture() {
  console.log("taking pictures");
  
  index.getGoogleIoTClient(function(err, client, project_id) {
    if(err != null) {
      console.log("Failed to get Google IoT client");
      console.log(err);
      return;
    }
    
    device_configuration = index.generate_device_configuration();
    device_configuration = JSON.stringify(device_configuration);
    
    index.modifyDeviceConfig(client, project_id, CLOUD_REGION, REGISTRY_ID, DEVICE_ID, device_configuration)
  });
};

const requestHandler = (request, response) => {
  console.log(request.headers);
  if(request.headers['x-appengine-cron'] == null) {
    return response.end(JSON.stringify({"error": "unsupported"}));
  }
  
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
