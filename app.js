require('./utils.js');
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo').default;
const bcrypt = require('bcrypt');
const saltRounds = 12;

const app = express();

const Joi = require('joi');

const PORT = process.env.PORT || 3000;
const expireTime = 60 * 60 * 1000; //expires after 1 hour  (minutes * seconds * millis)

const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_user_database = process.env.MONGODB_USER_DATABASE;
const mongodb_session_database = process.env.MONGODB_SESSION_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;

const {database} = include('databaseConnection');
const userCollection = database.db(mongodb_user_database).collection('users');

var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_session_database}`,
	crypto: {
		secret: mongodb_session_secret
	}
});

app.use(session({ 
    secret: node_session_secret,
	store: mongoStore, //default is memory store 
	saveUninitialized: false, 
	resave: true
}
));



app.get('/', (req, res) => {
    res.send(`<h1>Hello World!</h1>
        <form action="/login" method="get">
            <button type="submit">Log in</button>
        </form>
        <form action="/signup" method"get">
            <button type="submit">Sign up</button>
        </form>`);
});

app.get('/login', (req, res) => {
    let html = `<h1>Hello, guy!</h1>`
    res.send(html);
});

app.get('/signup', (req, res) => {
    let html = `<h2>Create User</h2>`
    res.send(html);
});

app.use(express.static(__dirname + "/public"));

app.use((req, res) => {
    res.status(404);
    res.send(`<h1 style="text-align:center">404 Page not found</h1>
        <div style="width:100%;height:0;padding-bottom:68%;position:relative;">
        <iframe src="https://giphy.com/embed/Y7O7xzwqS5kVB1w396" width="100%" height="100%" 
        style="position:absolute" frameBorder="0" class="giphy-embed" allowFullScreen></iframe>
        </div><p><a href="https://giphy.com/gifs/kiiikiii-official-new-404-kiiikiii-Y7O7xzwqS5kVB1w396">via GIPHY</a></p>`)
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});