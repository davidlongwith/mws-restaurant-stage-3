let restaurant;
var newMap;
const favoriteBttn = document.getElementById('favorite-button');    // favorite button
let favoriteBttnLabel;    // favorite button label

/**
 * Initialize map as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {  
  initMap();
});

/**
 * Initialize leaflet map
 */
initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {      
      self.newMap = L.map('map', {
        center: [restaurant.latlng.lat, restaurant.latlng.lng],
        zoom: 16,
        scrollWheelZoom: false
      });
      L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}', {
        mapboxToken: 'pk.eyJ1IjoiZGF2aWRsMzY5IiwiYSI6ImNqamRoa25nNDEyM3YzcHBlYmI0Ym92aGQifQ.DTiCCs0ChZ8Xq7TlEKLR1w',
        maxZoom: 18,
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
          '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
          'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
        id: 'mapbox.streets'    
      }).addTo(newMap);
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
    }
  });
}  
 
/* window.initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.map = new google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    }
  });
} */

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
}

/**
 * Favorite button UI
 */
displayFavorite = (restaurant = self.restaurant) => {
  if (restaurant.is_favorite == "true") {
    isFavorite();
  } else {
    notFavorite();
  }
  favoriteBttn.setAttribute('aria-label', favoriteBttnLabel);
}

/**
 * Set UI as favorite
 */
function isFavorite(restaurant = self.restaurant) {
  favoriteBttn.innerHTML = '🧡';   // Orange Heart - Unicode number U+1F9E1
  favoriteBttnLabel = restaurant.name + ' is favorite';
}

/**
 * Set UI as not a favorite
 */
function notFavorite(restaurant = self.restaurant) {
  favoriteBttn.innerHTML = '♡';   // White Heart Suit - Unicode number U+2661
  favoriteBttnLabel = restaurant.name + ' not a favorite';
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  // favorite button
  displayFavorite();    // display appropriate favorite button UI on page load
  favoriteBttn.onclick = function(restaurant) {
    const restaurantID = self.restaurant.id;
    let favoriteStatus = self.restaurant.is_favorite;
    console.log('onclick restaurant id: ', restaurantID);
    console.log('is_favorite status = ', favoriteStatus);
    
    // new favorite status
    let setFavStatus;
    if (favoriteStatus === false || favoriteStatus === "false" || favoriteStatus == undefined) {
      setFavStatus = "true";
    } else {
      setFavStatus = "false";
    }
    console.log('setFavStatus = ', setFavStatus);
    
    // update favorite on server
    let url = DBHelper.DATABASE_URL + '/restaurants/' + restaurantID + '/?is_favorite=' + setFavStatus;
    fetch(url, {
      method: 'PUT'
    })
    .then(response => response.json())
    .then(json => {
      console.log('The json response is: ', json);
      
      // update favorite in idb
      DBHelper.DBOpen()
      .then(db => {
        const tx = db.transaction('restaurants', 'readwrite');
        const allRestaurants = tx.objectStore('restaurants');
        allRestaurants.put(json);
      });
      return json;
    })
    .then(() => {
      // update button to match new status
      if (setFavStatus == "true") {
        isFavorite();
      } else {
        notFavorite();
      }
    })
    .catch(error => {
      console.log('unable to save favorite at this time: ', error);
    });
  };

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img'
  image.alt = 'Image for the restaurant ' + restaurant.name;
  image.src = DBHelper.imageUrlForRestaurant(restaurant);

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fetchReviews();
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Post new review on form submission.
 */
addReview = () => {
  event.preventDefault();    // Stop form from submitting normally
  
  // gather form data
  const id = self.restaurant.id;
  const name = document.getElementsByName("user_name")[0].value;
  const rating = document.getElementsByName("user_rating")[0].value;
  const comments = document.getElementsByName("user_comments")[0].value;
  
  // prepare review parameters
  const url = DBHelper.DATABASE_URL + '/reviews/';
  const formData = {
    "restaurant_id": id,
    "name": name,
    "rating": rating,
    "comments": comments
    };
  
  // add to indexeddb
  DBHelper.addReviewIDB(formData);
  
  // add to server
  DBHelper.addReviewServer(url, formData);
}

/*  */

/**
 * Get reviews for current restaurant
 */
fetchReviews = () => {
  const id = self.restaurant.id;
  DBHelper.fetchReviewsByRestaurant(id, (error, reviews) => {
    console.log('display restaurant reviews: ', reviews);
    fillReviewsHTML(reviews);
  });
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.restaurant.reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h3');
  title.setAttribute('tabindex','0');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  li.setAttribute('tabindex','0');
  const name = document.createElement('p');
  name.innerHTML = review.name;
  li.appendChild(name);

  const date = document.createElement('p');
  date.innerHTML = review.date;
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  li.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.setAttribute('tabindex','0');
  li.setAttribute('aria-label',restaurant.name);
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
