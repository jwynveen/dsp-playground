var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  var model = {
    title: 'Express',
    dataFile: {}
  };
  res.render('index', model);
});

module.exports = router;
