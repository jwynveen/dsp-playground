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
      files: files.map(function (file) {
        return {
          value: file,
          text: file,
          selected: file === req.body.datafile
        };
      }),
      xCol: 'time',
      yCol: 'accMag'
    };
    return res.render('index', model);
  });
});
router.post('/', function (req, res) {
  async.waterfall([
    function initWaterfall(callback) {
      return callback(null, req.body);
    },
    function getFileList(options, callback) {
      fs.readdir(dataDirectory, function (err, files) {
        options.files = files.map(function (file) {
          return {
            value: file,
            text: file,
            selected: file === req.body.datafile
          };
        });
        return callback(err, options);
      });
    },
    function getData(options, callback) {
      if (!options.datafile) {
        return callback('Must select a file', options);
      }
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
              data.x.push(Number(row[xIdx]));
              data.y.push(Number(row[yIdx]));
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
        var dataset = options.data[0];

        // === Mean ===
        if (options.mean || options.stddev1 || options.stddev2) {
          var mean = dataset.y.reduce(function (sum, value) {
              return sum + value;
            }, 0) / dataset.y.length;

          if (options.mean) {
            options.data.push({
              name: 'Mean',
              x: [dataset.x[0], dataset.x[dataset.x.length - 1]],
              y: [mean, mean],
              line: {
                dash: 'dash',
                width: 1,
                color: '#D62728'
              }
            });
          }
          if (options.stddev1 || options.stddev2) {
            var sd = dataset.y.reduce(function (sum, value) {
              return sum + Math.pow(value - mean, 2);
            }, 0) / dataset.y.length;

            if (options.stddev1) {
              options.data.push({
                name: '+1 SD',
                x: [dataset.x[0], dataset.x[dataset.x.length - 1]],
                y: [mean + sd, mean + sd],
                line: {
                  dash: 'dash',
                  width: 1,
                  color: '#FF7F0E'
                }
              });
              options.data.push({
                name: '-1 SD',
                x: [dataset.x[0], dataset.x[dataset.x.length - 1]],
                y: [mean - sd, mean - sd],
                line: {
                  dash: 'dash',
                  width: 1,
                  color: '#FF7F0E'
                }
              });
            }
            if (options.stddev2) {
              options.data.push({
                name: '+2 SD',
                x: [dataset.x[0], dataset.x[dataset.x.length - 1]],
                y: [mean + (sd * 2), mean + (sd * 2)],
                line: {
                  dash: 'dash',
                  width: 1,
                  color: '#8C564B'
                }
              });
              options.data.push({
                name: '-2 SD',
                x: [dataset.x[0], dataset.x[dataset.x.length - 1]],
                y: [mean - (sd * 2), mean - (sd * 2)],
                line: {
                  dash: 'dash',
                  width: 1,
                  color: '#8C564B'
                }
              });
            }
          }
        }
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
