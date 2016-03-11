var express = require('express');
var router = express.Router();
var fs = require('fs');
var parse = require('csv-parse');
var async = require('async');
var dataDirectory = './public/data/';

router.get('/', function (req, res) {
  fs.readdir(dataDirectory, function (err, files) {
    if (err) {
      throw err;
    }

    var model = {
      files: files,
      xCol: 'time',
      yCol: 'accMag'
    };
    return res.render('index', model);
  });
});
router.post('/', function (req, res) {
  async.waterfall([
    function getFileList(callback) {

      fs.readdir(dataDirectory, function (err, files) {
        return callback(err, {files: files});
      });
    },
    function getParams(options, callback) {
      options.datafile = req.body.datafile;
      options.xCol = req.body.xCol || 'time';
      options.yCol = req.body.yCol || 'accMag';
      if (!options.datafile) {
        return callback('Must select a file', options);
      }
      return callback(null, options);
    },
    function getData(options, callback) {
      fs.readFile(dataDirectory + options.datafile, function (err, csvSourceFile) {
        if (err) {
          return callback(err);
        }
        parse(csvSourceFile, function (err, output) {
          if (err) {
            return callback(err);
          }
          if (!output || !output.length) {
            return callback('File is empty', options);
          }
          var xIdx = output[0].indexOf(options.xCol);
          if (xIdx < 0) {
            return callback('Could not find X column. Columns: ' + JSON.stringify(output[0]), options);
          }
          var yIdx = output[0].indexOf(options.yCol);
          if (yIdx < 0) {
            return callback('Could not find Y column. Columns: ' + JSON.stringify(output[0]), options);
          }

          output.splice(0, 1);  // Delete header row
          try {
            options.data = [output.reduce(function (data, row) {
              data.x.push(row[xIdx]);
              data.y.push(row[yIdx]);
              return data;
            }, {x: [], y: [], name: 'Original'})];
            return callback(null, options);
          } catch (ex) {
            return callback(ex, options);
          }
        });
      });
    },
    function processData(options, callback) {
      if (options.data && options.data.length) {
        // TODO: Other processing goes here

        options.dataString = JSON.stringify(options.data);
      }
      return callback(null, options);
    }
  ], function (err, options) {
    if (err) {
      if (typeof err === 'string') {
        options.errorMessage = err;
      } else {
        options.errorMessage = err.toString();
        throw err;
      }
    }
    return res.render('index', options);
  });
});
/*router.post('/process', function (req, res) {
  return res.json({
    ok: true,
    result: [{
      x: [1, 2, 3, 4, 5],
      y: [1, 2, 4, 8, 16]
    }]
  });
});*/
module.exports = router;
