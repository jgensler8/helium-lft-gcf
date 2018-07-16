const assert = require('chai').assert;
const index = require('./index');
const buffer = require('buffer');

function fake_packet(){
  return {
    "transaction_id": 1,
    "packet_index": 2,
    "total_number_of_packets": 3,
    "data": "aGVsbG8=\n"
  };
};

function fake_event() {
  return {
    "eventId": "",
    "timestamp": "",
    "eventType": "",
    "resource": "",
    "data": fake_upload_event_data()
  };
};

function fake_upload_event_data() {
  return {
    "@type": "",
    "attributes": [],
    "data": "MSwyLDMsYUdWc2JHOD0K"
  };
};

function fake_assemble_event_data() {
  return "1234";
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

function fake_detection_boxes(){
  return [[0.24290436506271362, 0.34011751413345337, 0.3496599793434143, 0.4212002158164978]];
};

function fake_high_detection_scores() {
  return [.9];
};

function fake_low_detection_scores(){ 
  return [0];
}

describe('heliumlft', function() {
  
  describe('#newPacket()', function() {
    it('should create an object', function() {
      packet = index.newPacket(1,1,1,"data");
      assert.isObject(packet);
      assert.hasAllKeys(packet, ["transaction_id", "packet_index", "total_number_of_packets", "data"]);
      assert.isString(packet["transaction_id"], "transaction_id");
      assert.isNumber(packet["packet_index"], "packet_index");
      assert.isNumber(packet["total_number_of_packets"], "totoal_number_of_packets");
      assert.isString(packet["data"], "data");
    });
  });
  
  describe('#parsePacket()', function() {
    it('should create a new Packet', function() {
      packet = index.parsePacket('1,2,3,aGVsbG8=\n');
      assert.isObject(packet);
      assert.deepEqual(packet["transaction_id"], '1');
      assert.deepEqual(packet["packet_index"], 2);
      assert.deepEqual(packet["total_number_of_packets"], 3);
      assert.deepEqual(packet["data"], "aGVsbG8=\n");
    })
  });
  
  describe('#getPacketFromUploadEventData', function(){
    it('should return the fake packet data', function() {
      eventData = fake_upload_event_data();
      packet = index.getPacketFromUploadEventData(eventData);
      correct_packet = fake_packet();
      assert.equal(packet["transaction_id"], correct_packet["transaction_id"]);
      assert.equal(packet["packet_index"], correct_packet["packet_index"]);
      assert.equal(packet["total_number_of_packets"], correct_packet["total_number_of_packets"]);
      assert.equal(packet["data"], correct_packet["data"]);
    })
  })
  
  describe('#getTransactionIdFromAssembleEventData', function() {
    it('should return a string', function() {
      eventData = fake_assemble_event_data();
      assert.isString(eventData);
    });
  })
  
  describe('#getKeyFromUploadEventData', function() {
    it('should return the key for a new PubSub Event', function() {
      eventData = fake_upload_event_data();
      datastore = fake_datastore();
      key = index.getKeyFromUploadEventData(datastore, eventData);
      assert.equal(key, "lft-event-1-2")
    });
  });
  
  describe('#storeEventData', function() {
    it('should return the same data when we call get', function() {
      eventData = fake_upload_event_data();
      datastore = fake_datastore();
      index.storePacket(datastore, eventData);
      packet = datastore.get(index.getKeyFromUploadEventData(datastore, eventData));
      assert.deepEqual(packet["transaction_id"], '1');
    })
  });
  
  describe('#assembleBlobFromDatastore', function() {
    it('should create a whole piece of data from multiple obejcts', function(done) {
      datastore = fake_datastore();
      datastore.runQuery = function(query) {
        return new Promise(function(resolve, reject) {
          resolve([[{"data": "aGVsbG8g\n"}, {"data": "d29ybGQ=\n"}], {"moreResults": "", "endCursor": ""}]);
        })
      };
      
      index.assembleBlobFromDatastore(datastore, "bogus", function(err, message){
        assert.equal(err, null);
        assert.equal("hello world", message.toString('ascii'));
        // will never be called if assert fails
        done();
      })
    })
  });
  
  describe('#generate_device_configuration', function() {
    it('should return floats for both values', function() {
      dc = index.generate_device_configuration();
      assert.isObject(dc);
      assert.isNumber(dc[index.CHECKPOINT_KEY]);
      assert.isNumber(dc[index.DELTA_KEY]);
      assert.include("" + dc[index.CHECKPOINT_KEY], ".")
      assert.include("" + dc[index.DELTA_KEY], ".")
    })
  });
  
  describe('#assembleBlobFromDatastore @integration', function() {
    
  })

  describe('#get_qualified_objects_from_detections', function(){
    it('should return one objects when given one bounding box and high score', function(){
      objects = index.get_qualified_objects_from_detections(fake_detection_boxes(), fake_high_detection_scores())
      assert.isArray(objects)
      assert.equal(objects.length, 1)
      
      o = objects[0];
      assert.hasAllKeys(o, ["center", "area"])
      assert.isNumber(o["center"])
      assert.isNumber(o["area"])
    });

    it('should return no objects when score is too low', function(){
      objects = index.get_qualified_objects_from_detections(fake_detection_boxes(), fake_low_detection_scores());
      assert.isArray(objects)
      assert.isEmpty(objects)
    });
  });

  describe('#detect_objects @integration', function(){
    it('should return four objects', function(done) {
      this.timeout(8000);

      index.detect_objects("", "1527937205.jpeg", function(err) {
        if(err != null) {
          console.log(err)
          assert.fail()
        }
        done();
      })
    })
  })
  
});
