if (this.importScripts) {
    importScripts('../../../resources/testharness.js');
    importScripts('../../../resources/generic-idb-operations.js');
}

(function() {
  var dbname = location.pathname + ' - ' + 'changes';
  var putOps = [{type: 'put', key : 1, value: 1 },
                {type: 'put', key : 2, value: 2 } ];
  var deleteOps = [ {type: 'delete', key: {lower : 1, upper : 3} }, {type: 'delete', key: {lower : 1, upper : 2} }];
  var addOps = [ {type: 'add', key : 3, value: 3 } ];
  var clearOps = [ {type: 'clear'} ];
  
  var ops1 = putOps.concat(deleteOps, addOps, clearOps);
  var records1 = { 'store' : ops1 };
  var callback_count1 = 0;
  var observed_ops1 = putOps.concat(clearOps);
  var observed_records1 = { 'store' : observed_ops1 };
  var observed_changes1 = { dbName: dbname+'1', records: observed_records1 };

  function callback1(changes) {
    compareChanges(changes, observed_changes1);
    callback_count1++;
  };
  
  async_test(function(t) {
    var openRequest = indexedDB.open(dbname+'1');
    var cnt2 = 0;
    var obs1 = new IDBObserver(t.step_func(callback1), { operationTypes: ['clear', 'put'] });
    var obs2 = new IDBObserver(t.step_func(function(){
      cnt2++;
    }));

    openRequest.onupgradeneeded = t.step_func(function() {
      createDatabase(openRequest.result, ['store']);
    });
    openRequest.onsuccess = t.step_func(function() {
      var db = openRequest.result;
      var tx1 = db.transaction('store', 'readwrite');
      var tx2 = db.transaction('store', 'readwrite');
      obs1.observe(db, tx1);
      obs2.observe(db, tx1);
      operateOnTx(tx2, records1);

      tx1.oncomplete = t.step_func(function() {
        countCallbacks(callback_count1, 0);
        countCallbacks(cnt2, 0);

      });
      tx2.oncomplete = t.step_func(function() {
        countCallbacks(callback_count1, 1);
        countCallbacks(cnt2, 0);
        t.done();
      });
    });
  }, 'Observer: Operation type filtering');

  var callback_count2 = 0;
  var records2 = { 'store' : putOps, 'store2' : addOps };
  var observed_records2 = { 'store' : putOps };
  var observed_changes2 = { dbName: dbname+'2', records: observed_records2 };
  
  function callback2(changes){
    compareChanges(changes, observed_changes2);
    callback_count2++;
  }
  var stores = ['store', 'store2']
  
  async_test(function(t) {
    var openRequest = indexedDB.open(dbname+'2');
    var obs = new IDBObserver(t.step_func(callback2), { operationTypes: ['put', 'add'] });

    openRequest.onupgradeneeded = t.step_func(function() {
      createDatabase(openRequest.result, stores);
    });
    openRequest.onsuccess = t.step_func(function() {
      var db = openRequest.result;
      var tx1 = db.transaction(stores[0], 'readwrite');
      var tx2 = db.transaction(stores, 'readwrite');
      obs.observe(db, tx1);
      operateOnTx(tx2, records2);

      tx1.oncomplete = t.step_func(function() {
        countCallbacks(callback_count2, 0);
      });
      tx2.oncomplete = t.step_func(function() {
        countCallbacks(callback_count2, 1);
        t.done();
      });
    });
  }, 'Observer: ObjectStore filtering');
  
  //3
  var callback_count3 = 0;
  var ops3 = putOps;
  var records3 = { 'store' : ops3 };
  var observed_records3 = { 'store' : putOps };
  var observed_changes3 = { dbName: dbname+'3', records: observed_records3 };

  function callback3(changes){
    compareChanges(changes, observed_changes3);
    callback_count3++;
  }
  async_test(function(t) {
    var openRequest = indexedDB.open(dbname+'3');
    var obs = new IDBObserver(t.step_func(callback3), { operationTypes: ['put'] });

    openRequest.onupgradeneeded = t.step_func(function() {
      createDatabase(openRequest.result, ['store']);
    });
    openRequest.onsuccess = t.step_func(function() {
      var db = openRequest.result;
      var tx1 = db.transaction('store', 'readwrite');
      // External transaction on same database connection.
      operateOnDb(db, records3);
      var tx2 = db.transaction('store', 'readwrite');
      operateOnTx(tx2, records3);
      obs.observe(db, tx1);

      tx1.oncomplete = t.step_func(function() {
        countCallbacks(callback_count3, 0);
      });
      tx2.oncomplete = t.step_func(function() {
        countCallbacks(callback_count3, 2);
        t.done();
      });
      tx2.onerror = t.unreached_func('tx should not have error');
    });
  }, 'Observer records external transaction');

  done();
})();
