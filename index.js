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
  const query = datastore.createQuery(kind);
  query.filter('transaction_id', transaction_id);
  query.order('packet_index');
  datastore.runQuery(query, function(err, entities) {
    if(err != null) {
      return callback(err);
    }
    
    blob = "";
    
    entities.forEach(function(entity) {
      record = entity[datastore.DATA];
      data = record["data"];
      blob += data;
    })
    
    callback(err, blob);
  });
}

/**
 * Background Cloud Function.
 *
 * @param {object} event The Cloud Functions event.
 * @param {function} callback The callback function.
 */
exports.heliumlft = (event, callback) => {
  eventData = event["data"];
  console.log("EventData", eventData);
  
  exports.storePacket(datastore, eventData, function(err) {
    if(err != null) {
      console.log("Error storing Packet", err)
    }
    callback(err)
  })
};
