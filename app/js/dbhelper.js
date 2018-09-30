
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
      if (!upgradeDB.objectStoreNames.contains('restaurants')) {          // if this object store doesn't exist...
        console.log('creating new object store: restaurants');            // log object store creation
        upgradeDB.createObjectStore('restaurants', { keyPath: 'id' });    // create object store and set key
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

  /* fetch all restaurants (database then server) */
  static fetchRestaurants(callback) {
    DBHelper.DBGetRestaurants().then(data => {                    // get data from database
      console.log('database contents: ', data);                   // log existing database content
      if (data.length > 0) {                                      // if some data is present
        return callback(null, data);                              // return promise/function callback
      }
      
      console.log('fetching from server');                              // log new fetch request
      fetch(`${DBHelper.DATABASE_URL}/restaurants`)                     // fetch new data from the server
      .then(response => response.json())                                // return converted to json
      .then(fetchedData => {                                                    // use the new json data
        DBHelper.DBOpen().then(db => {                                          // start a database transaction
          let tx = db.transaction('restaurants', 'readwrite');                  // setup transaction with these store(s)
          let allRestaurants = tx.objectStore('restaurants');                   // select which store to use
          fetchedData.forEach(restaurant => allRestaurants.put(restaurant));    // go through json data and put each restaurant in the database
          return tx.complete;                                                   // all steps completed, finalize transaction
        })
        console.log('adding to database: ', fetchedData);                       // log new data from fetch request
        return callback(null, fetchedData);                                     // return promise/function callback
      })
    })
    .catch(error => {                                                 // error in promise chain
      console.log('fetchRestaurants failed: ', error.message);        // log error info
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
   * Fetch reviews by restaurant ID.
   */
  static fetchReviewsByRestaurant(id, callback) {
    fetch(`${DBHelper.DATABASE_URL}/reviews/?restaurant_id=` + id)
    .then(response => response.json())
    .then(reviews => {
      console.log('fetched reviews: ' + reviews);
      return callback(null, reviews);
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

