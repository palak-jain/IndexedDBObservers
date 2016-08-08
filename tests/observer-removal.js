if (this.importScripts) {
    importScripts('../../../resources/testharness.js');
    importScripts('../../../resources/generic-idb-operations.js');
}
//1
async_test(function(t) {
  var dbname = location.pathname + ' - ' + 'unobserve before tx completes';
  var openRequest = indexedDB.open(dbname);
  var callback_count = 0;
  var obs = new IDBObserver(t.step_func(function(){ callback_count++; }), { operationTypes: ['put'] });

  openRequest.onupgradeneeded = t.step_func(function() {
    createDatabase(openRequest.result, ['store']);
  });
  openRequest.onsuccess = t.step_func(function() {
    var db = openRequest.result;
    var tx1 = db.transaction('store', 'readwrite'); 
    var tx2 = db.transaction('store', 'readwrite');
    tx1.objectStore('store').get(1);
    tx2.objectStore('store').put(1,1);
    obs.observe(db, tx1); 

    tx1.oncomplete = t.step_func(function(){   
      countCallbacks([callback_count], [0]);
    });
    tx2.oncomplete = t.step_func(function(){ 
      countCallbacks([callback_count], [0]);
      t.done();
    });
    obs.unobserve(db);     
  });
}, 'Unobserve before associated transaction completes');
//2
async_test(function(t) {
  var dbname = location.pathname + ' - ' + 'unobserve after tx completes';
  var openRequest = indexedDB.open(dbname);
  var callback_count = 0;
  var obs = new IDBObserver(t.step_func(function(){ callback_count++; }), { operationTypes: ['put'] });

  openRequest.onupgradeneeded = t.step_func(function() {
    createDatabase(openRequest.result, ['store']);
  });
  openRequest.onsuccess = t.step_func(function() {
    var db = openRequest.result;
    var tx1 = db.transaction('store', 'readwrite'); 
    var tx2 = db.transaction('store', 'readwrite');
    tx1.objectStore('store').get(1);
    tx2.objectStore('store').put(1,1);
    obs.observe(db, tx1); 

    tx1.oncomplete = t.step_func(function(){   
      countCallbacks([callback_count], [0]);
      obs.unobserve(db); 
    });
    tx2.oncomplete = t.step_func(function(){ 
      countCallbacks([callback_count], [0]);
      t.done();
    });    
  });
}, 'Unobserve after associated transaction completes');

  async_test(function(t) {
    var openRequest1 = indexedDB.open(dbname+'3');
    var cnt1 = 0, cnt2 = 0;
    var obs1 = new IDBObserver(t.step_func(function(){ cnt1++; }));
    var obs2 = new IDBObserver(t.step_func(function(){ cnt2++; }));
    openRequest1.onupgradeneeded = t.step_func(function() {
      createDatabase(openRequest.result, ['store']);
    });
    openRequest1.onsuccess = t.step_func(function() {
      var db = openRequest1.result;
      var tx1 = db.transaction('store', 'readwrite'); 
      var tx2 = db.transaction('store', 'readwrite');
      var tx3 = db.transaction('store', 'readwrite');
      var tx4 = db.transaction('store', 'readwrite');

      obs1.observe(db, tx1);
      obs2.observe(db, tx2);
      
      tx1.objectStore('store').put(1,1);
      tx2.objectStore('store').put(1,1);
      tx3.objectStore('store').put(2,2);
      tx4.objectStore('store').put(2,2);

      tx1.abort();  // Observer 1 not registered
      tx3.abort();  // No callback fired, but observer not removed.
      
      tx1.oncomplete = t.unreached_func('tx aborted');
      tx1.onabort = t.step_func(function(){
        assert_equals(cnt1, 0, 'obs1 callback count'); // No observer registered here.
        assert_equals(cnt2, 0, 'obs2 callback count');  
      });
      tx2.oncomplete = t.step_func(function(){  
        assert_equals(cnt1, 0, 'obs1 callback count'); 
        assert_equals(cnt2, 0, 'obs2 callback count'); // Observer 2 registered here.
      });
      tx3.oncomplete = t.unreached_func('tx aborted');
      tx3.onabort = t.step_func(function(){           // No callbacks fired.
        assert_equals(cnt1, 0, 'obs1 callback count');  
        assert_equals(cnt2, 0, 'obs2 callback count');
      });
      tx4.oncomplete = t.step_func(function(){
        assert_equals(cnt1, 0, 'obs1 callback count'); 
        assert_equals(cnt2, 1, 'obs2 callback count');
      });

      var openRequest2 = indexedDB.open(dbname+'4');
      openRequest2.onupgradeneeded = t.step_func(function() {
          var db2 = openRequest2.result;
          db2.createObjectStore('store');
      });
      openRequest2.onsuccess = t.step_func(function() {
        var db2 = openRequest2.result;
        var tx5 = db2.transaction('store', 'readwrite'); 
        var tx6 = db2.transaction('store', 'readwrite');

        obs1.observe(db2, tx5);
        db.close();
        obs1.unobserve(db);  // No effect
        obs1.unobserve(db);  // Multiple removal

        tx6.objectStore('store').put(1,1);
        tx6.oncomplete = t.step_func(function(){
          assert_equals(cnt1, 1, 'obs1 callback count');
        }); 
      });
     
      var openRequest3 = indexedDB.open(dbname+'3');
      openRequest3.onsuccess = t.step_func(function(){
        var db3 = openRequest3.result;
        var tx7 = db3.transaction('store', 'readwrite'); 
        tx7.objectStore('store').put(1,1);
        tx7.oncomplete = t.step_func(function(){
          assert_equals(cnt1, 1, 'obs1 callback count'); // All observers have been cleared.
          assert_equals(cnt2, 1, 'obs2 callback count');
          t.done();
        });
      });
    });
  }, 'observer lifetime test');
//  
//  async_test(function(t) {
//    var openRequest1 = indexedDB.open(dbname+'3');
//    var cnt1 = 0, cnt2 = 0;
//    var obs1 = new IDBObserver(t.step_func(function(){ cnt1++; }));
//    var obs2 = new IDBObserver(t.step_func(function(){ cnt2++; }));
//    openRequest1.onupgradeneeded = t.step_func(function() {
//        var db = openRequest1.result;
//        db.createObjectStore('store');
//    });
//    openRequest1.onsuccess = t.step_func(function() {
//      var db = openRequest1.result;
//      var tx1 = db.transaction('store', 'readwrite'); 
//      var tx2 = db.transaction('store', 'readwrite');
//      var tx3 = db.transaction('store', 'readwrite');
//     
//      obs1.observe(db, tx1);
//      obs1.observe(db, tx1);
//      
//      tx1.objectStore('store').put(1,1);
//      tx2.objectStore('store').put(1,1);
//     
//      tx2.oncomplete = t.step_func(function(){  
//        assert_equals(cnt1, 2, 'obs1 callback count'); 
//        obs1.unobserve(db);
//        obs1.unobserve(db);
//      });
//      
//     
//      obs1.observe(tx2);
//
//      tx3.oncomplete = t.step_func(function(){
//        assert_equals(cnt1, 0, 'obs1 callback count'); 
//        assert_equals(cnt2, 1, 'obs2 callback count');
//      });
//
//      var openRequest2 = indexedDB.open(dbname+'4');
//      openRequest2.onupgradeneeded = t.step_func(function() {
//          var db2 = openRequest2.result;
//          db2.createObjectStore('store');
//      });
//      openRequest2.onsuccess = t.step_func(function() {
//        var db2 = openRequest2.result;
//        var tx5 = db2.transaction('store', 'readwrite'); 
//        var tx6 = db2.transaction('store', 'readwrite');
//
//        obs1.observe(db2, tx5);
//        db.close();
//        obs1.unobserve(db);  // No effect
//        obs1.unobserve(db);  // Multiple removal
//
//        tx6.objectStore('store').put(1,1);
//        tx6.oncomplete = t.step_func(function(){
//          assert_equals(cnt1, 1, 'obs1 callback count');
//        }); 
//      });
//     
//      var openRequest3 = indexedDB.open(dbname+'3');
//      openRequest3.onsuccess = t.step_func(function(){
//        var db3 = openRequest3.result;
//        var tx7 = db3.transaction('store', 'readwrite'); 
//        tx7.objectStore('store').put(1,1);
//        tx7.oncomplete = t.step_func(function(){
//          assert_equals(cnt1, 1, 'obs1 callback count'); // All observers have been cleared.
//          assert_equals(cnt2, 1, 'obs2 callback count');
//          t.done();
//        });
//      });
//    });
//  }, 'observer lifetime test');
//  
//  
  





