const index = require('./index');
const http = require('http');
const Datastore = require('@google-cloud/datastore');
const PubSub = require('@google-cloud/pubsub');
const port = 8080;

const configuration = require('./configuration.json');
const CLOUD_REGION = configuration["CLOUD_REGION"];
const REGISTRY_ID = configuration["REGISTRY_ID"];
const DEVICE_ID = configuration["DEVICE_ID"];
const ASSEMBLE_TOPIC_NAME = configuration["ASSEMBLE_TOPIC_NAME"];

const datastore = new Datastore();
const pubsub = new PubSub();

function cron_assemble() {
  console.log("Running Assemle Query");
  query = datastore
    .createQuery(index.kind)
    .groupBy('transaction_id');
  datastore.runQuery(query)
    .then(function(entities) {
      transaction_ids = [];
      
      entities[0].forEach(function(entity) {
        transaction_ids.push(entity["transaction_id"]);
      });
      
      transaction_ids.forEach(function(transaction_id) {
        console.log("triggering assemble for transaction_id " + transaction_id)
        pubsub
          .topic(ASSEMBLE_TOPIC_NAME)
          .publisher()
          .publish(new Buffer("" + transaction_id))
          .then(messageId => {
            console.log(messageId);
          })
          .catch(err => {
            console.log(err);
          });
      });
      
    })
    .catch(function(err) {
      console.log(err)
    });
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
