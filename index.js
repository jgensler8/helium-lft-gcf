const Datastore = require('@google-cloud/datastore');
const Storage = require('@google-cloud/storage');
const buffer = require('buffer');

const kind = "lft-event";

const datastore = new Datastore();

const gcs_bucket = Storage().bucket('mushroom-images');

exports.newPacket = function(transaction_id, packet_index, total_number_of_packets, data) {
  return {
    "transaction_id": '' + transaction_id,
    "packet_index": packet_index,
    "total_number_of_packets": total_number_of_packets,
    "data": data
  };
}

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
}

exports.getKeyFromEventData = function(datastore, eventData) {
  var b = new buffer.Buffer(eventData["data"], 'base64');
  packet = exports.parsePacket(b.toString('ascii'));
  return datastore.key([kind, packet["transaction_id"] + "-" + packet["packet_index"] ])
}

exports.getPacketFromEventData = function(eventData) {
  var b = new buffer.Buffer(eventData["data"], 'base64');
  return exports.parsePacket(b.toString('ascii'));
}

exports.getTransactionIdFromEventData = function(eventData) {
    var b = new buffer.Buffer(eventData["data"], 'base64');
    return parseInt(b.toString('ascii'));
}

exports.storePacket = function(datastore, eventData, callback) {
  const entity = {
    key: exports.getKeyFromEventData(datastore, eventData),
    data: exports.getPacketFromEventData(eventData)
  };

  datastore.save(
    entity,
    (err) => {
      callback(err)
    }
  );
}

exports.assembleBlobFromDatastore = function(datastore, transaction_id, callback) {
  const query = datastore
    .createQuery(kind)
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
}

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
  
  transaction_id = exports.getTransactionIdFromEventData(eventData);
  console.log("transaction_id", transaction_id);
  
  exports.assembleBlobFromDatastore(datastore, transaction_id, function(err, blob){
    if(err == null) {
      gcs_bucket.file("" + transaction_id + ".jpeg").save(blob);
    }
    callback(err);
  });
}
