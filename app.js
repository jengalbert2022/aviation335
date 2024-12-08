require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); //need to enable fetch since apparently it doesn't exist if i dont explicitly call this

//console section to launch the server locally
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

//MongoDB section
const { MONGO_DB_USERNAME, MONGO_DB_PASSWORD, MONGO_DB_NAME, MONGO_COLLECTION, RAPIDAPI_KEY } = process.env;
const MONGO_URI = `mongodb+srv://${MONGO_DB_USERNAME}:${MONGO_DB_PASSWORD}@cluster0.xxzkf.mongodb.net/${MONGO_DB_NAME}?retryWrites=true&w=majority`;
mongoose.connect(MONGO_URI, {
  retryWrites: true,
  w: 'majority'
}).catch(err => console.error('MongoDB error:', err));
const searchSchema = new mongoose.Schema({
  icao: String,
  searchDate: { type: Date, default: Date.now }
});
const Search = mongoose.model(MONGO_COLLECTION, searchSchema);

//endpoints for the app
app.get('/', (req, res) => {
  res.render('index');
});

//search for flight, also mainpage
//upon entering the ICAO code for an airport (eg: KSFO for San Francisco Intl, KDCA for Reagan, RCTP for Taiwan Taoyuan Intl, etc...)
//RapidAPI is called for Flightera Flight Data API, concerned with only arrival flights
app.post('/search', async (req, res) => {
  const icao = req.body.icao || 'KSFO';
  await new Search({ icao }).save();

  const url = `https://flightera-flight-data.p.rapidapi.com/airport/flights?direction=arrival&ident=${icao}`;
  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': 'flightera-flight-data.p.rapidapi.com'
    }
  };

  try {
    const response = await fetch(url, options);
    const result = await response.json();
    const flights = result.flights || [];
    res.render('results', { flights, icao });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error data retrieve RapidAPI');
  }
});

//pulls up past search history of airports, which resides on MongoDB
app.get('/history', async (req, res) => {
  const searches = await Search.find().sort({ searchDate: -1 });
  res.render('history', { searches });
});

//console launch
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
