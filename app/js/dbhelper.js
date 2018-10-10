
/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * Database URL.
   */
  static get DATABASE_URL() {
    const port = 1337; // Change this to your server port
    return `http://localhost:${port}`;
  }

  /**
   * ---IndexedDB Upgrade Function---
   * Create or remove object stores and indexes here.
   * .open() returns a promise that can be used later to get/put items in the database
   */
  static DBOpen() {
    if (!navigator.serviceWorker) {   // check browser support for service workers
      return Promise.resolve();       // stop here and return promise if browser doesn't support sw's
    }
  
    return idb.open('restaurants-DB', 1, upgradeDB => {                   // (name, version, upgradeCallback)
      switch(upgradeDB.oldVersion) {                                        // oldVersion property indicates what version the browser already has
        case 0:                                                             // check for this store, skip if already up-to-date
          if (!upgradeDB.objectStoreNames.contains('restaurants')) {          // if this object store doesn't exist...
            console.log('creating new object store: restaurants');            // log object store creation
            upgradeDB.createObjectStore('restaurants', { keyPath: 'id' });    // create object store and set key
          }
        case 1:                                                             // no 'break' statement means all cases get checked
          if (!upgradeDB.objectStoreNames.contains('reviews')) {
            console.log('creating new object store: reviews');
            upgradeDB.createObjectStore('reviews', { autoIncrement: true });   // auto generate key separate from data
          }
        case 2:
          let reviewStore = upgradeDB.transaction.objectStore('reviews');   // transaction on the 'reviews' object store
          reviewStore.createIndex('current-restaurant', 'restaurant_id');   // new index called 'current-restaurant' that sorts by 'restaurant_id' property
        case 3:
          if (!upgradeDB.objectStoreNames.contains('reviews-pending')) {
            console.log('creating new object store: reviews-pending');
            upgradeDB.createObjectStore('reviews-pending', { autoIncrement: true });
          }
      }
    });
  }

  /* retrieve restaurant data from database */
  static DBGetRestaurants() {
    return DBHelper.DBOpen()                                // return promise to calling function; open DB to access it
    .then(db => {                                           // .open returned a promise for accessing database
      let tx = db.transaction('restaurants', 'readonly');   // setup transaction with this store
      let allRestaurants = tx.objectStore('restaurants');   // use this store
      return allRestaurants.getAll();                       // get all restaurants from db, return promise up the chain
    });
  }  

  /**
   * Fetch all restaurants (database then server).
   */
  static fetchRestaurants(callback) {
    DBHelper.DBGetRestaurants().then(data => {                    // get data from database
      console.log('database contents: ', data);                   // log existing database content
      if (data.length > 0) {                                      // if some data is present
        callback(null, data);                                     // return promise/function callback
        return;                                                   // stop and return
      }
      
      console.log('fetching restaurants from server');                  // log new fetch request
      fetch(`${DBHelper.DATABASE_URL}/restaurants`)                     // fetch new data from the server
      .then(response => response.json())                                // return converted to json
      .then(fetchedData => {                                                    // use the new json data
        DBHelper.DBOpen().then(db => {                                          // start a database transaction
          let tx = db.transaction('restaurants', 'readwrite');                  // setup transaction with these store(s)
          let allRestaurants = tx.objectStore('restaurants');                   // select which store to use
          fetchedData.forEach(restaurant => allRestaurants.put(restaurant));    // go through json data and put each restaurant in the database
          return tx.complete;                                                   // all steps completed, finalize transaction
        })
        console.log('adding to idb: ', fetchedData);                      // log new data from fetch request
        callback(null, fetchedData);                                      // return promise/function callback
        return;                                                           // stop and return
      })
    })
    .catch(error => {                                                 // error in promise chain
      console.log('fetchRestaurants failed: ', error.message);        // log error info
    });
  }
  
  /**
   * Favorites
   */
  static setFavorite() {
    const url = DBHelper.DATABASE_URL + '/restaurants/' + restaurantID + '/?is_favorite=' + setFav;
  }
  
  /* retrieve pending reviews */
  static DBGetPending() {
    return DBHelper.DBOpen()
    .then(db => {
      let tx = db.transaction('reviews-pending', 'readwrite');
      let pendingReviews = tx.objectStore('reviews-pending');
      return pendingReviews.getAll();
    });
  }
  
  /* retrieve reviews (by 'restaurant_id' property) from idb */
  static DBGetReviews(id) {
    return DBHelper.DBOpen()
    .then(db => {
      let tx = db.transaction('reviews', 'readonly');
      let restaurantReviews = tx.objectStore('reviews');
      let reviewIndex = restaurantReviews.index('current-restaurant');    // reference index created in idb.open
      return reviewIndex.getAll(id);
    });
  }
  
  /**
   * Fetch all reviews by restaurant ID (database then server).
   */
  static fetchReviewsByRestaurant(id, callback) {
    // send pending reviews to server
    DBHelper.DBGetPending()
    .then(pending => {
      console.log('pending reviews???', (pending));
      const url = DBHelper.DATABASE_URL + '/reviews/';
      fetch(url, {
        method: 'POST',
        body: JSON.stringify(pending)
        }
      )
      .catch(error => {
        console.log('reviews pending...', error);
      });
    })
    
    // check idb for reviews
    DBHelper.DBGetReviews(id)
    .then(data => {
      console.log('reviews store contents: ', data);
      if (data.length > 0) {
        return callback(null, data);
      }
      
      // fetch reviews from server and save to idb
      console.log('fetching reviews from server');
      fetch(`${DBHelper.DATABASE_URL}/reviews/?restaurant_id=` + id)
      .then(response => response.json())
      .then(fetchedReviews => {
        DBHelper.DBOpen().then(db => {
          let tx = db.transaction('reviews', 'readwrite');
          let restaurantReviews = tx.objectStore('reviews');
          fetchedReviews.forEach(review => restaurantReviews.put(review));
          return tx.complete;
        })
        console.log('adding reviews to idb: ', fetchedReviews);
        return callback(null, fetchedReviews);
      });
    })
  }
  
  /**
   * Add new review to indexeddb.
   */
  static addReviewIDB(formData) {
    DBHelper.DBOpen()
    .then(db => {
      let tx = db.transaction('reviews', 'readwrite');
      let addReview = tx.objectStore('reviews');
      addReview.put(formData);
      return tx.complete;
    })
    .catch(error => {
      console.log('save to idb failed: ', error);
    });
  }
  
  /**
   * Add new review to server.
   */
  static addReviewServer(url, formData) {
    fetch(url, {
      method: 'POST',
      body: JSON.stringify(formData)
      }
    )
    .then(res => res.json())
    .then(response => console.log('The review was submitted: ', response))
    .catch(error => {
      console.log('save to pending reviews');
      DBHelper.addReviewPending(formData);
    });
  }
  
  /**
   * Add new review to offline pending idb store.
   */
  static addReviewPending(formData) {
    DBHelper.DBOpen()
    .then(db => {
      let tx = db.transaction('reviews-pending', 'readwrite');
      let pendingReview = tx.objectStore('reviews-pending');
      pendingReview.put(formData);
      return tx.complete;
    })
    .catch(error => {
      console.log('save to pending-idb failed: ', error);
    });
  }
   
  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        const restaurant = restaurants.find(r => r.id == id);
        if (restaurant) { // Got the restaurant
          callback(null, restaurant);
        } else { // Restaurant does not exist in the database
          callback('Restaurant does not exist', null);
        }
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        let results = restaurants
        if (cuisine != 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine);
        }
        if (neighborhood != 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood);
        }
        callback(null, results);
      }
    });
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        callback(null, uniqueNeighborhoods);
      }
    });
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null);
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, uniqueCuisines);
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    return (`/img/${restaurant.photograph}.jpg`);
  }

  /**
   * Map marker for a restaurant.
   */
   static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker  
    const marker = new L.marker([restaurant.latlng.lat, restaurant.latlng.lng],
      {title: restaurant.name,
      alt: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant)
      })
      marker.addTo(newMap);
    return marker;
  } 
  /* static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
      position: restaurant.latlng,
      title: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant),
      map: map,
      animation: google.maps.Animation.DROP}
    );
    return marker;
  } */

}

