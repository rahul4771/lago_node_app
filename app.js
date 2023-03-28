var express = require('express');
var cors = require('cors');
var logger = require('morgan');
var upload = require("express-fileupload");

const bodyParser = require('body-parser');

var adminRouter = require('./Routes/admin.routes');

var app = express();

var whitelist = ['https://lago-apparel-cad.myshopify.com'];
var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}
// app.use(cors(corsOptions));
app.use(cors());
app.use(upload());
app.use('/Images', express.static(__dirname + '/Images'));
app.use('/images', express.static(__dirname + '/images'));
app.use('/js', express.static(__dirname + '/js'));
app.use('/css', express.static(__dirname + '/css'));

app.use(logger('dev'));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: false, parameterLimit: 50000 }));
app.use(bodyParser.json({ extended: false, limit: '50mb' }));

app.use('/', adminRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    res.status(err.status || 404).json({
        message: 'No such route exists'
    })
});

// error handler
app.use(function(err, req, res, next) {
  console.log(err);
    res.status(err.status || 500).json({
        message: 'Error Message'
    })
});

const PORT = process.env.PORT || 4001;
app.listen(PORT);
