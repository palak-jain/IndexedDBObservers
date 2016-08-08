Indexeddb Observer

Issue: [crbug.com/609934](https://bugs.chromium.org/p/chromium/issues/detail?id=609934)

This doc: [https://goo.gl/Y2dobn](https://goo.gl/Y2dobn)

Go link: [go/idbobserver](http://goto.google.com/idbobserver)

Explainer: [https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md](https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md)

Presentation: [https://goo.gl/cYv4Xo](https://goo.gl/cYv4Xo)

Major Cls

* [2031113002](https://codereview.chromium.org/2031113002) IDL constructs

* [2062203004](https://codereview.chromium.org/2062203004) Observer Lifetime Management

* [2160163002](https://codereview.chromium.org/2160163002/) Propagating Changes to Observer : Browser

* [2125213002](https://codereview.chromium.org/2125213002) Propagating Changes to Observer : Renderer

* [2163213006](https://codereview.chromium.org/2163213006) Add Observer Test

**Table of Contents**

[[TOC]]

# Overview

## *What?*

 An observer records  the changes to database (on the same origin) and propagates the changes back to listener. 

* Propagate changes to all listeners, in *all browsing contexts*.

* Allow customization/filtering of changes to record for performance, and default to something relatively fast

* Allow *data consistency* in the observation callback, so that clients can read the 'current' state of the work after the change.

Example:

Observer obs;

ObjectStore obj

obj.put(1,1)                           → { type: put , key: 1 , value: 1 }

obj.put(2,2)		           → { type: put , key: 2 , value: 2 } 

obj.delete(1)                         → { type: delete , key: 1 }

## *Why?* 

	

* IndexedDB doesn't have any observer support. This could normally be implemented by the needed website (or third party) as a wrapper around the database. However, IDB spans browsing contexts (tabs, workers, etc), and implementing a javascript wrapper that supports all of the needed features would be very difficult .

* Allowing data consistency in the observation callback would not be possible

* Optimization and guaranteeing safe implementation 

## *How*?

Once instantiated, observer starts listening to database operations as per its filters.

On completion of a transaction, observer fires a callback with the collected changes.

# Use Cases

1. Server Sync Case

We want to synchronize changes to a webserver. Let's say we're storing all of our operations in an oplog, which we send to the network whenever we get changes, and then delete the records afterwards. If we ever close/crash/timeout before the records are sent, they'll be around for our next run.

*Code Snippet *

`// We are bad developers and don't batch our network calls.
// We just send them whenever there's a change.
var onDatabaseChanges = function(changes) {
  var changesForNetwork = [];
  changes.records.get('oplog').forEach(change => {
    changesForNetwork.push(change);
  });
  sendChangesToNetwork(changesForNetwork).then(function() {
      var removalTxn = db.transaction('oplog', 'readwrite');
      removalTxn.objectstore('oplog').delete(changesForNetwork); // psuedocode here
    });
}
var observer = new IndexedDBObserver(
    onDatabaseChanges, { onlyExternal: true, values: true, operations: ['add', 'put'] });

var txn = db.transaction('oplog', 'readonly');
observer.observe(db, txn);
// Here we catch any changes that we missed due to crashing
// or shutting down.
var readAll = txn.getAll();
readAll.onsuccess = function() {
  sendPendingChangesToNetwork(readAll.result).then(function() {
      var removalTxn = db.transaction('oplog', 'readwrite');
      removalTxn.objectstore('oplog').delete(readAll.result); // psuedocode here
    }).catch(function(){
      // couldn't send changes to network.
    });
}
txn.oncomplete = function() {
  console.log('Database is initialized and we are syncing changes');
}`

2. UI Update element

A  polymer or angular webapp with have databinding working. We need to constantly update our UI element on database change. 

[https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md#ui-element](https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md#ui-element)

3. Maintaining an in-memory data cache 

IDB can be slow due to disk, so it's a good idea to have an in-memory cache

[https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md#maintaining-an-in-memory-data-cache](https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md#maintaining-an-in-memory-data-cache)

4. Custom refresh logic

 If we just want to know when an object store has changed. This isn't the most efficient, but this might be the 'starting block' websites use to transition to observers, as at some point they would read the database using a transaction to update their UI.

	  [https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md#custom-refresh-logic](https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md#custom-refresh-logic)

# Interface

## Construction 

####                                 new IDBObserver(callback, options)

 **Callback**: 

* The observer callback function will be called whenever a transaction is successfully completed on the applicable object store/s. There is one observer callback per applicable observe call.

* The observer functionality starts after the transaction the observer was created in is completed. This allows the creator to read the 'true' state of the world before the observer starts. In other words, this allows the developer to control exactly when the observing begins.

* The function will continue observing until either the database connection used to create the transaction is closed (and all pending transactions have completed), or unobserve() is called on the observer.

## Observe call

#### [IDBObserver.observe(database, transaction, ranges)](https://github.com/WICG/indexed-db-observers/blob/gh-pages/IDBObservers.webidl) 

* This function starts observation on the target database connection using the given transaction. 

* We start observing the object storegit s that the given transaction is operating on (the object stores returned by IDBTransaction.objectStoreNames). 

* Observation will start at the end of the given transaction

*  The observer's callback is fired at the end of every transaction that operates on the chosen object stores

* The observer stops when either the database connection is closed or IDBObserver.unobserve is called with the target database.

# Lifetime

Before we begin, note that:

* IDBObserver object lives only on the renderer. It, specifically the callback has no presence in the backend.

* It is the observe call at renderer end, and not the object itself, that has a one to one mapping to Observer object in the browser.

* We use id’s to refer to the same observer between renderer and browser.

For the purpose of explanation, the reference to ‘observer’ would represent an observe call. All references to IDBObserver object are explicitly stated so.

## Addition

#### observer.observe(db, tx)

Renderer

1. Each observer has an id unique to the renderer.

2. Observer is held in the renderer in a map of <id, object*>

3. We do bookkeeping of observer id in each Observer object as well as each database. (Needed for removal purposes)

4. Send an IPC message to browser with id and other filter options

Browser

5. Observer held on transaction as ‘pending’ . It does not start listening yet.

6. On completion of transaction, all associated ‘pending’ observers are ‘activated’ i.e. they start listening to database. These **active observers are owned by the connection** they were created on.  It is only at this point that the observer start listening to changes.

## Removal

There are 3 cases of removal of observer:

1. Unobserve call  ( obs.unobserve(db) )

2. Connection closed by user (db.close() )

3. Force connection close

Each of the cases has a different entry point and covers a different set of observers. Ensuring consistency of sequence of operations here is an important issue, since we need that callbacks should immediately stop on removal.

1. Unobserve : 

    1. We require observer to be removed from an intersection of database and observer object. Remove all references of observer from renderer and then browser.

    2. At the backend, if associated transaction has not yet finished, observer would have to be removed from pending observer list as well.

2. Connection close

1. We need all the observers observing on the database. That’s why (the only reason why) we hold their ids on database. 

2. Note that database does not have a reference to the observer object (IDBObserver) itself. So, we route through the dispatcher, get hold of the observer object via ids, and then remove ids from each observer object.

3. Force Close

1. This is different from above 2 cases since, removal initiates at the browser end. 

2. At browser, as connection is destroyed, observers are destroyed too.

3. At renderer, the entry point of observer destruction is database and process is similar to connection close.

# Changes

## Browser

* An observation involves a single operation performed within a transaction (ex. put, add). It consists of the objectstore, operation type {put, add, delete, clear}, key( or keyrange), values.

* On completion of a transaction (and not on completion of an operation), we send a single message per connection comprising all the observations that any of the observers on the connection might be recording.

* The change message consists of

    * Any observation that an observer of a connection might be listening to

    * A map of observer_id to set of indices corresponding to the required observations in the observation list.

* Note that,

    * We have a separate observation set for each connection. This involves constructing and storing repeated observations. However, having a single giant set of observations would mean sending a huge message to renderer. Also, a lot of additional computation at renderer. 

    * We do not have a separate observation set per observer. This would have introduced a lot of redundancy.

* The filtering logic is currently a brute force technique of traversing each observer for each connection and checking if it records the observation.

## Renderer

* The message is multiplexed to each observer

* An observer extracts the appropriate subset of observations using its set of indices and fires a callback.

* Note that the **callback is fired before the corresponding transactions on complete handler**.

# Future Implementation Plans

1.  ReadOnly Transaction 

Provide option to create a readonly transaction for the objectstores that you're observing every time the observer function is called. This transaction provides a snapshot of the post-commit state. This does not go through the normal transaction queue, but can delay subsequent transactions on the observer's object stores. The transaction is active during the callback, and becomes inactive at the end of the callback task or microtask.

2. Filtering Algorithm

Improve filtering mechanisms from current brute force implementation to an efficient algorithm/data structure like B+ trees.

3. Culling[ ](https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md#culling)

[https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md#culling](https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md#culling)

# FAQs

1. Why do both Observer object and database at the renderer hold observer ids?

	IDBObserver and Database are in the same thread, but store different ids. 

Consider,

obs1 = new IDBObserver();

obs2 = new IDBObserver();

obs1.observe(db1);   // id 1

obs1.observe(db2);   // id 2

obs2.observe(db1);   // id 3

obs1.observer_id = { 1, 2 }

obs2.observer_id = { 3 }

db1.observer_id = { 1, 3 }

db2.observer_id = { 2 }

obs1.unobserve(db2)  // removes id 2

db1.close()          // removes id 1, 3

We need both the lists because there are 2 ways to remove the observe calls

i. obs.unobserve(db) : This removes all observe calls associated with the observer object 'obs' on the database 'db'.

ii. connection close : This removes all observe calls of all the observers on the database 'db'. 

Thus, we need to bookkeep observe calls on an intersection of observer and database to deal with unobserve functionality.

2. A re-iteration of some messy orders

	Observer only starts listening after the initial transaction it was created with completes.

* For a change, Observer callback is fired before the corresponding transaction on complete is fired.

* Unobserve  immediately stops the observer. There would be no callback after that.

*  Observers callback fire in the order in which they are registered  (observe call)

3. Why do we need to have an associated transaction?

We always need a transaction before we start observing. This is for the user to know the initial state of the database. In other words, we need to guarantee the point after which all changes are recorded.

4.  Why not transaction.observe(..) or objStore.observe(..) ?

	This is to make our spec consistent with rest of observer models on web.

The observe call’s lifetime is associated with the first argument of observe call i.e. the database.

5.  Why cannot we observe during version change? 

Observer listens to a database. Listening during version change implies we will have to keep the database alive. During version change, we must close the db so as to modify it.

More FAQs: [https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md#faq](https://github.com/WICG/indexed-db-observers/blob/gh-pages/EXPLAINER.md#faq)

