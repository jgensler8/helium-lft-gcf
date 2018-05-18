const Datastore = require('@google-cloud/datastore');
const datastore = new Datastore();
const buffer = require('buffer');

const kind = "lft-event";

exports.newPacket = function(transaction_id, packet_index, total_number_of_packets, data) {
  return {
    "transaction_id": transaction_id,
    "packet_index": packet_index,
    "total_number_of_packets": total_number_of_packets,
    "data": data
  };
}

exports.parsePacket = function(packetString) {
  packetParts = packetString.split(",");
  return exports.newPacket(packetParts[0], packetParts[1], packetParts[2], packetParts[3]);
}

exports.getKeyFromEventData = function(datastore, eventData) {
  packet = exports.parsePacket(eventData["data"]);
  return datastore.key([kind, packet["transaction_id"] + packet["packet_index"] ])
}

exports.getPacketFromEventData = function(eventData) {
  var b = new buffer.Buffer(eventData["data"], 'base64');
  return exports.parsePacket(b.toString('ascii'));
}

exports.getTransactionIdFromEventData = function(eventData) {
    var b = new buffer.Buffer(eventData["data"], 'base64');
    return b.toString('ascii');
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
      blob += entity["data"];
    })
    
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
      console.log(blob)
    }
    callback(err);
  });
}
