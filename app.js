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

const { database } = include('databaseConnection');
const userCollection = database.db(mongodb_user_database).collection('users');

userCollection.createIndex({ email: 1 }, { unique: true });

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

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
    if (req.session.authenticated) {
        let name = req.session.name;

        let html = `
            <link rel="stylesheet" href="/css/style.css">

            <h1>Hello ${name}!</h1>
            <form action="/members" method="get">
                <button>Members Lounge</button>
            </form>
            <form action="/logout" method="get">
                <button>Log out</button>
            </form>
        `;
        res.send(html);
        return;
    } else {
        let html = `
            <link rel="stylesheet" href="/css/style.css">

            <h1>Home</h1>
            <form action="/login" method="get">
                <button>Log in</button>
            </form>
            <form action="/signup" method"get">
                <button>Sign up</button>
            </form>
            `;

        res.send(html);
    }
});

app.get('/login', (req, res) => {
    if (req.session.authenticated) {
        res.redirect('/');
        return;
    }

    let html = `
        <link rel="stylesheet" href="/css/style.css">

        <h2>Log in</h2>
        <form action="/loginSubmit" method="post">
            <input type="email" name="email" placeholder="email">
            <br>
            <input type="password" name="password" placeholder="password">
            <br>
            <button class="submit">Submit</button>
        </form>
    `;
    res.send(html);
});


app.post('/loginSubmit', async (req, res) => {
    let email = req.body.email;
    let password = req.body.password;

    if (email && password) {

        const schema = Joi.string().max(50).required();


        const valdiationResult = schema.validate(email);
        if (valdiationResult.error != null) {
            console.log(valdiationResult.error);
            res.redirect('/login');
            return;
        }

        const result = await userCollection.find({ email: email }).project({ name: 1, email: 1, password: 1, _id: 1 }).toArray();
        console.log(result);

        let invalidHtml = `
            <p>Invalid <b>user/password</b>.</p>
            <a href="/login">Retry</a>
        `;
        if (result.length != 1) {
            console.log("Invalid user");
            res.send(invalidHtml);
            return;
        }
        if (await bcrypt.compare(password, result[0].password)) {
            console.log("Login successful");
            req.session.authenticated = true;
            req.session.name = result[0].name;
            req.session.cookie.maxAge = expireTime;

            res.redirect('/members');
            return;
        }
        else {
            console.log("Invalid password");
            res.send(invalidHtml);
            return;
        }
    }
    else {
        let html = `
        <link rel="stylesheet" href="/css/style.css">
        `;
        if (!email && !password) html += `<p><b>Email</b> and <b>password</b> can't be empty.</p>`;
        else if (!email) html += `<p><b>Email</b> can't be empty.</p>`;
        else if (!password) html += `<p><b>Password</b> can't be empty.</p>`;

        html += `<a href="/login">Retry</a>`

        res.send(html);
        return;
    }
});


app.get('/signup', (req, res) => {
    if (req.session.authenticated) {
        res.redirect('/');
        return;
    }

    let html = `
    <link rel="stylesheet" href="/css/style.css">

    <h2>Create User</h2>
    <form action="/signupSubmit" method="post">
        <input type="text" name="name" placeholder="name">
        <br>
        <input type="email" name="email" placeholder="email">
        <br>
        <input type="password" name="password" placeholder="password">
        <br>
        <button class="submit">Submit</button>
    </form>
    `;
    res.send(html);
});

app.post('/signupSubmit', async (req, res) => {
    let name = req.body.name;
    let email = req.body.email;
    let password = req.body.password;

    if (name && email && password) {

        const schema = Joi.object(
            {
                name: Joi.string().max(20).required(),
                email: Joi.string().max(50).required(),
                password: Joi.string().max(20).required()
            }
        );

        const valdiationResult = schema.validate({ name, email, password });
        if (valdiationResult.error != null) {
            console.log(valdiationResult.error);
            res.redirect('/signup');
            return;
        }

        let hashedPassword = await bcrypt.hash(password, saltRounds);

        try {
            await userCollection.insertOne({ name: name, email: email, password: hashedPassword });
            console.log("User successfully added.");
        } catch (error) {
            if (error.code === 11000) {
                let html = `
                <link rel="stylesheet" href="/css/style.css">
                <p><b>Email</b> is already taken.</p>
                <a href="/signup">Retry</a>
                `;
                res.send(html);
                return;
            }
            throw error;
        }

        req.session.authenticated = true;
        req.session.name = name;
        req.session.cookie.maxAge = expireTime;

        res.redirect('/members');
        return;
    }
    else {
        let html = `
        <link rel="stylesheet" href="/css/style.css">
        `;

        const fields = [];

        if (!name) fields.push("<b>Name</b>");
        if (!email) fields.push("<b>Email</b>");
        if (!password) fields.push("<b>Password</b>");

        if (fields.length === 1) {
            html += `<p>${fields[0]} can't be empty.</p>`;
        } else if (fields.length === 2) {
            html += `<p>${fields[0]} and ${fields[1]} can't be empty.</p>`;
        } else {
            html += `<p>${fields[0]}, ${fields[1]}, and ${fields[2]} can't be empty.</p>`;
        }

        html += `<a href="/signup">Retry</a>`

        res.send(html);
        return;
    }

});


app.get('/members', (req, res) => {
    if (!req.session.authenticated) {
        res.redirect('/');
        return;
    }

    let name = req.session.name;

    let images = ["hani.jpg", "raven.jpg", "yaniShany.jpg"];
    let random = Math.floor(Math.random() * images.length);
    let selectedImage = images[random];


    let html = `
        <link rel="stylesheet" href="/css/style.css">

        <h1>Hello ${name}!</h1>
        <div><img src='img/${selectedImage}'></div>
        <br>
        <form action="/logout" method="get">
            <button type="submit">Log out</button>
        </form>
    `;
    res.send(html);
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
})



app.use(express.static(__dirname + "/public"));

app.get(/.*/, (req, res) => {
    res.status(404);
    res.send(`
        <h1 style="text-align:center">404 Page not found</h1>

        <img src="img/404.gif" alt="404" style="display: block; margin-left: auto; margin-right: auto">
        `)
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});