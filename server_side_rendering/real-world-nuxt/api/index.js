const express = require("express");
const bodyParser = require("body-parser")
const logger = require("express-logger")
// const morgan = require("morgan")
const cookieParser = require('cookie-parser')
const inspect = require("util-inspect")
const oauth = require("oauth");
const session = require('express-session');
var reddit_config = require('../static/reddit_config.js')
var tConfig = require("../static/twitter_config.js")
const snoowrap = require("snoowrap");
var twit = require('twit');


// const router = express.Router();

var app = express();

var app2 = express();

app.use((req, res, next) => {
  Object.setPrototypeOf(req, app2.request)
  Object.setPrototypeOf(res, app2.response)
  req.res = res
  res.req = req
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers,X-Access-Token,XKey,Authorization');
  res.locals.session = req.session;
  next()
})

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(logger({ path: "log/express.log"}));
// app.user(morgan({ path: "log/express.log"}))
app.use(cookieParser());
app.use(session({ secret: "very secret", resave: false, saveUninitialized: true}));

var _twitterConsumerKey = tConfig.consumer_key;
var _twitterConsumerSecret = tConfig.consumer_secret;
var consumer = new oauth.OAuth(
  "https://twitter.com/oauth/request_token", "https://twitter.com/oauth/access_token",
_twitterConsumerKey, _twitterConsumerSecret, "1.0A", "http://localhost:8080/sessions/callback", "HMAC-SHA1");

app.get('/sessions/connect', function(req, res){
  consumer.getOAuthRequestToken(function(error, oauthToken, oauthTokenSecret, results){
    if (error) {
      res.send("Error getting OAuth request token : " + inspect(error), 500);
    } else {
      req.session.oauthRequestToken = oauthToken;
      req.session.oauthRequestTokenSecret = oauthTokenSecret;
      console.log("Double check on 2nd step");
      console.log("------------------------");
      console.log("<<"+req.session.oauthRequestToken);
      console.log("<<"+req.session.oauthRequestTokenSecret);
      res.redirect("https://twitter.com/oauth/authorize?oauth_token="+req.session.oauthRequestToken);
    }
  });
});

app.get('/sessions/callback', function(req, res){
  console.log("------------------------");
  console.log(">>"+req.session.oauthRequestToken);
  console.log(">>"+req.session.oauthRequestTokenSecret);
  console.log(">>"+req.query.oauth_verifier);
  consumer.getOAuthAccessToken(req.session.oauthRequestToken, req.session.oauthRequestTokenSecret, req.query.oauth_verifier, function(error, oauthAccessToken, oauthAccessTokenSecret, result) {
    if (error) {
      res.send("Error getting OAuth access token : " + inspect(result) + "[" + oauthAccessToken + "]" + "[" + oauthAccessTokenSecret + "]" + "[" + inspect(result) + "]", 500);
    } else {
      req.session.oauthAccessToken = oauthAccessToken;
      req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;
      twitter = new twit({
        consumer_key:         _twitterConsumerKey,
        consumer_secret:      _twitterConsumerSecret,
        access_token:         oauthAccessToken,
        access_token_secret:  oauthAccessTokenSecret,
        // timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
        // strictSSL:            true,     // optional - requires SSL certificates to be valid.
      });
      res.redirect('/');
    }
  });
});

app.get('/twitter_login', function(req, res){
  consumer.get("https://api.twitter.com/1.1/account/verify_credentials.json", req.session.oauthAccessToken, req.session.oauthAccessTokenSecret, function (error, data, response) {
    if (error) {
      //console.log(error)
      res.redirect('/sessions/connect');
    } else {
      var parsedData = JSON.parse(data);
      return res.json({ message: 'success' })
    }
  });
  // res.send("hello")
});

app.get('/reddit_callback', function(req, res){
  res.redirect('/');
});

app.get('/reddit_login', function(req, res){
  var authenticationUrl = snoowrap.getAuthUrl({
      clientId: reddit_config.clientId,
      scope: ['edit', 'mysubreddits', 'read', 'submit', 'vote'],
      redirectUri: 'http://localhost:8080/reddit_callback',
      permanent: false,
      state: 'randomstring' // a random string, this could be validated when the user is redirected back
  });
  console.log(authenticationUrl);
  res.redirect(authenticationUrl);
});


module.exports = {
  path:"/",
  handler:app
}
