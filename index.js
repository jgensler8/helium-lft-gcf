const Datastore = require('@google-cloud/datastore');
const Storage = require('@google-cloud/storage');
const {google, cloudiot_v1, ml_v1} = require('googleapis');
const googleauth = require('google-auth-library');
const buffer = require('buffer');
const fs = require('fs');

const SERVICE_ACCOUNT_FILE = require('./service-account.json');
const CONFIGURATION = require('./configuration.json');
const ML_MODEL_RESOURCE = CONFIGURATION["ML_MODEL_RESOURCE"];
const DETECTION_SCORE_THRESHOLD = CONFIGURATION["DETECTION_SCORE_THRESHOLD"]

exports.lft_event_kind = "lft-event";
exports.qualified_object_kind = "qualified-object";
exports.CHECKPOINT_KEY = "checkpoint";
exports.DELTA_KEY = "delta";
// This is in seconds
exports.DELTA = 120.1;
const datastore = new Datastore();

const gcs_bucket = Storage().bucket('mushroom-images');

exports.modifyDeviceConfig = function(client, project_id, cloud_region, registry_id, device_id, device_configuration) {
  const binaryData = Buffer.from(device_configuration).toString('base64');
  const request = {
    name: `projects/${project_id}/locations/${cloud_region}/registries/${registry_id}/devices/${device_id}`,
    binaryData: binaryData
  };

  client.projects.locations.registries.devices.modifyCloudToDeviceConfig(request)
  .then(function(data) {
    console.log(data);
  })
  .catch(function(err) {
    console.log(err);
  })
};

exports.getGoogleIoTClient = function(cb) {
  var credentials = SERVICE_ACCOUNT_FILE;
  var client = googleauth.auth.fromJSON(credentials);
  client.scopes = ['https://www.googleapis.com/auth/cloud-platform']
  // set the global options to use this for auth
  google.options({
    auth: client
  });

  // create the iot client
  var iotclient = new cloudiot_v1.Cloudiot({}, google);
  cb(null, iotclient, client.projectId);
};

exports.getCloudMLClient = function(cb) {
  var credentials = SERVICE_ACCOUNT_FILE;
  var client = googleauth.auth.fromJSON(credentials);
  client.scopes = ['https://www.googleapis.com/auth/cloud-platform']
  // set the global options to use this for auth
  google.options({
    auth: client
  });

  // create the cloud ml client
  var mlclient = new ml_v1.Ml({}, google);
  cb(null, mlclient, client.projectId);
};

exports.generate_device_configuration = function() {
  device_configuration = {};
  device_configuration[exports.CHECKPOINT_KEY] = Date.now() / 1000;
  device_configuration[exports.DELTA_KEY] = exports.DELTA;
  return device_configuration;
};

exports.newPacket = function(transaction_id, packet_index, total_number_of_packets, data) {
  return {
    "transaction_id": '' + transaction_id,
    "packet_index": packet_index,
    "total_number_of_packets": total_number_of_packets,
    "data": data
  };
};

exports.parsePacket = function(packetString) {
  transaction_id_index = packetString.indexOf(",");
  transaction_id = packetString.substring(0, transaction_id_index);
  packetString = packetString.substring(transaction_id_index + 1)
  
  packet_index_index = packetString.indexOf(",");
  packet_index = parseInt(packetString.substring(0, packet_index_index));
  packetString = packetString.substring(packet_index_index + 1);
  
  total_number_of_packets_index = packetString.indexOf(",");
  total_number_of_packets = parseInt(packetString.substring(0, total_number_of_packets_index));
  data = packetString.substring(total_number_of_packets_index + 1);
  
  return exports.newPacket(transaction_id, packet_index, total_number_of_packets, data);
};

exports.getKeyFromUploadEventData = function(datastore, eventData) {
  var b = new buffer.Buffer(eventData["data"], 'base64');
  packet = exports.parsePacket(b.toString('ascii'));
  return datastore.key([exports.lft_event_kind, packet["transaction_id"] + "-" + packet["packet_index"] ])
};

exports.getPacketFromUploadEventData = function(eventData) {
  var b = new buffer.Buffer(eventData["data"], 'base64');
  return exports.parsePacket(b.toString('ascii'));
};

exports.getTransactionIdFromAssembleEventData = function(eventData) {
  var b = new buffer.Buffer(eventData["data"], 'base64');
  return b.toString('ascii');
};

exports.storePacket = function(datastore, eventData, callback) {
  const entity = {
    key: exports.getKeyFromUploadEventData(datastore, eventData),
    data: exports.getPacketFromUploadEventData(eventData)
  };

  datastore.save(
    entity,
    (err) => {
      callback(err)
    }
  );
};

exports.assembleBlobFromDatastore = function(datastore, transaction_id, callback) {
  const query = datastore
    .createQuery(exports.lft_event_kind)
    .filter('transaction_id', '=', transaction_id)
    .order('packet_index', {
      ascending: true,
    });
  datastore.runQuery(query).then(entities => {
    blob = "";
    
    entities[0].forEach(function(entity) {
      console.log("Packet Index:", entity["packet_index"]);
      entity_data = entity["data"];
      // remove trailing null terminator
      entity_data = entity_data.substring(0, entity_data.length - 1);
      entity_data = new buffer.Buffer(entity_data, 'base64');
      entity_data = entity_data.toString('hex');
      blob += entity_data;
    })
    
    blob = new buffer.Buffer(blob, 'hex');
    
    callback(null, blob);
  }).catch(err => {
    console.log(err)
    callback(err)
  });
};

exports.getKeyFromQualifiedObject = function(datastore, qualified_object) {
  return datastore.key([exports.qualified_object_kind, qualified_object.center.x + "-" + qualified_object.center.y]);
};

exports.store_qualified_object = function(datastore, qualified_object, callback) {
  const entity = {
    key: exports.getKeyFromQualifiedObject(datastore, qualified_object),
    data: qualified_object
  };

  datastore.save(
    entity,
    (err) => {
      callback(err)
    }
  );
};

exports.get_qualified_objects_from_detections = function(detection_boxes, detection_scores){
  var objects = []
  detection_scores.forEach(function(score, score_index){
    if(score > DETECTION_SCORE_THRESHOLD) {
      object_box = detection_boxes[score_index];
      x_min = object_box[0];
      x_max = object_box[1];
      y_min = object_box[2];
      y_max = object_box[3];

      length = x_max - x_min;
      height = y_max - y_min;

      area = height * length;
      center = {
        "x": x_min + (length / 2),
        "y": y_min + (height / 2)
      }
      objects.push({
        "area": area,
        "center": center
      })
    }
  });
  return objects;
};

exports.detect_objects = function(bucket, file, callback) {
  exports.getCloudMLClient(function(err, client, project_id) {
    if(err != null) {
      console.log("Failed to create Cloud ML Client");
      callback(err)
    }

    // get image from datastore
    gcs_bucket.file(file).download().then(function(file){
      // for some reason, this returns an array of files
      b64file = file[0].toString('base64');
      b64file = b64file.replace(/\+/g, '-').replace(/\//g, '_');

      // get bounding boxes
      client.projects.predict({
        "name": ML_MODEL_RESOURCE,
        "resource": {
          "instances": [
            {
              "inputs": b64file
            }
          ]
        }
      })
      .then(function(response){
        prediction_result = response.data.predictions[0];

        detection_boxes = prediction_result["detection_boxes"];
        detection_scores = prediction_result["detection_scores"];

        qualified_objects = exports.get_qualified_objects_from_detections(detection_boxes, detection_scores);

        console.log("Qualified objects")
        console.log(qualified_objects)

        qualified_objects.forEach(function(qualified_object) {
          exports.store_qualified_object(datastore, qualified_object, function(err){
            if(err != null){
              console.log(err);
            }
          })
        })

      })
      .catch(callback)
    })
  });
};

/**
 * Background Cloud Function.
 *
 * @param {object} event The Cloud Functions event.
 * @param {function} callback The callback function.
 */
exports.heliumlft_upload = (event, callback) => {
  eventData = event["data"];
  console.log("EventData", eventData);
  
  exports.storePacket(datastore, eventData, function(err) {
    if(err != null) {
      console.log("Error storing Packet", err)
    }
    callback(err)
  })
};

exports.heliumlft_assemble = (event, callback) => {
  eventData = event["data"];
  console.log("EventData", eventData);
  
  transaction_id = exports.getTransactionIdFromAssembleEventData(eventData);
  console.log("transaction_id", transaction_id);
  
  exports.assembleBlobFromDatastore(datastore, transaction_id, function(err, blob){
    if(err == null) {
      gcs_bucket.file("" + transaction_id + ".jpeg").save(blob);
    }
    callback(err);
  });
};

exports.heliumlft_detect = (event, callback) => {
  const file = event.data;
  const file_bucket = file.bucket;
  const file_name = file.name;

  exports.detect_objects(file_bucket, file_name);
};