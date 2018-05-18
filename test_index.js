var assert = require('chai').assert;
var index = require('./index');

function fake_packet(){
  return {
    "transaction_id": 1,
    "packet_index": 2,
    "total_number_of_packets": 3,
    "data": "hello"
  };
};

function fake_event() {
  return {
    "eventId": "",
    "timestamp": "",
    "eventType": "",
    "resource": "",
    "data": fake_event_data()
  };
};

function fake_event_data() {
  return {
    "@type": "",
    "attributes": [],
    "data": "MSwyLDMsaGVsbG8="
  };
};

function fake_datastore() {
  return {
    DATA: "data",
    store: {},
    save: function(entity) {
      this.store[entity["key"]] = entity["data"];
    },
    get: function(key) {
      return this.store[key];
    },
    key: function(list) {
      return list.join("-");
    },
    createQuery: function() {
      return this;
    },
    filter: function() {
      return this;
    },
    order: function() {
      return this;
    }
  }
}

describe('heliumlft', function() {
  
  describe('#newPacket()', function() {
    it('should create an object', function() {
      packet = index.newPacket(1,1,1,"data");
      assert.isObject(packet);
      assert.hasAllKeys(packet, ["transaction_id", "packet_index", "total_number_of_packets", "data"]);
      assert.isNumber(packet["transaction_id"]);
      assert.isNumber(packet["packet_index"]);
      assert.isNumber(packet["total_number_of_packets"]);
      assert.isString(packet["data"]);
    });
  });
  
  describe('#parsePacket()', function() {
    it('should create a new Packet', function() {
      packet = index.parsePacket('1,2,3,data');
      assert.isObject(packet);
      assert.equal(packet["transaction_id"], 1);
      assert.equal(packet["packet_index"], 2);
      assert.equal(packet["total_number_of_packets"], 3);
      assert.equal(packet["data"], "data");
    })
  });
  
  describe('#getPacketFromEventData', function(){
    it('should return the fake packet data', function() {
      eventData = fake_event_data();
      packet = index.getPacketFromEventData(eventData);
      correct_packet = fake_packet();
      assert.equal(packet["transaction_id"], correct_packet["transaction_id"]);
      assert.equal(packet["packet_index"], correct_packet["packet_index"]);
      assert.equal(packet["total_number_of_packets"], correct_packet["total_number_of_packets"]);
      assert.equal(packet["data"], correct_packet["data"]);
    })
  })
  
  describe('#getKeyFromEventData', function() {
    it('should return the key for a new PubSub Event', function() {
      eventData = fake_event_data();
      datastore = fake_datastore();
      key = index.getKeyFromEventData(datastore, eventData);
      assert(key, "1-2")
    });
  });
  
  describe('#storeEventData', function() {
    it('should return the same data when we call get', function() {
      eventData = fake_event_data();
      datastore = fake_datastore();
      index.storePacket(datastore, eventData);
      packet = datastore.get(index.getKeyFromEventData(datastore, eventData));
      assert.equal(packet["transaction_id"], 1);
    })
  });
  
  describe('#assembleBlobFromDatastore', function() {
    it('should create a whole piece of data from multiple obejcts', function() {
      datastore = fake_datastore();
      datastore.runQuery = function(query) {
        return new Promise(function(resolve, reject) {
          resolve([[{"data": "hello "}, {"data": "world"}], {"moreResults": "", "endCursor": ""}]);
        })
      };
      
      index.assembleBlobFromDatastore(datastore, "bogus", function(err, message){
        assert.equal(err, null);
        assert.equal("hello world", message);
      })
    })
  });
  
  describe('#assembleBlobFromDatastore @integration', function() {
    
  })
  
});
