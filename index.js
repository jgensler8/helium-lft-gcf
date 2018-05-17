const Datastore = require('@google-cloud/datastore');
const datastore = new Datastore();

const key_prefix = "lft";

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

exports.getKeyFromEvent = function(datastore, event) {
  packet = exports.parsePacket(event["data"]);
  return datastore.key([key_prefix, packet["transaction_id"], packet["packet_index"] ])
}

exports.getPacketFromEvent = function(event) {
  return exports.parsePacket(event["data"]);
}

exports.storePacket = function(datastore, event, callback) {
  const entity = {
    key: exports.getKeyFromEvent(datastore, event),
    data: exports.getPacketFromEvent(event)
  };

  datastore.save(
    entity,
    (err) => {
      callback(err)
    }
  );
}

exports.assembleBlobFromDatastore = function(datastore, transaction_id, callback) {
  const query = datastore.createQuery(key_prefix);
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
  console.log(event);
  callback(null, `Hello ${event.data.name || 'World'}!`);
};
