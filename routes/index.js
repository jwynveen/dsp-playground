var express = require('express');
var router = express.Router();
var fs = require('fs');
var parse = require('csv-parse');
var async = require('async');
var dataDirectory = './public/data/';
var MatLabUtil = require('../MatLabUtil.js');

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

        // === Mean / Standard Deviation ===
        calculateMeanStdDev(options);
        options.workingData = options.data[0].y.slice();  // clone the y array so we don't edit the original
        if (options.filter1) {
          filter(options, 'filter1');
        }
        if (options.filter2) {
          filter(options, 'filter2');
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

module.exports = router;

function calculateMeanStdDev(options) {

  var dataset = options.data[0];
  if (options.mean || options.stddev1 || options.stddev2) {
    var mean = dataset.y.reduce(function (sum, value) {
        return sum + value;
      }, 0) / dataset.y.length;

    var xValues = dataset.x.slice(0, 20).concat(dataset.x[dataset.x.length - 1]);
    var yValues = Array.apply(null, Array(21));
    if (options.mean) {
      options.data.push({
        name: 'Mean',
        x: xValues,
        y: yValues.map(function () {
          return mean;
        }),
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
          x: xValues,
          y: yValues.map(function () {
            return mean + sd;
          }),
          line: {
            dash: 'dash',
            width: 1,
            color: '#FF7F0E'
          }
        });
        options.data.push({
          name: '-1 SD',
          x: xValues,
          y: yValues.map(function () {
            return mean - sd;
          }),
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
          x: xValues,
          y: yValues.map(function () {
            return mean + (sd * 2);
          }),
          line: {
            dash: 'dash',
            width: 1,
            color: '#8C564B'
          }
        });
        options.data.push({
          name: '-2 SD',
          x: xValues,
          y: yValues.map(function () {
            return mean - (sd * 2);
          }),
          line: {
            dash: 'dash',
            width: 1,
            color: '#8C564B'
          }
        });
      }
    }
  }
  return options;
}

function filter(options, filterId) {

  switch (options[filterId]) {
    case 'matlab_lowpass':
      matlabFilter(options, 'lowpass', filterId);
      break;
    case 'matlab_highpass':
      matlabFilter(options, 'highpass', filterId);
      break;
    case 'matlab_highpass_abs':
      matlabFilter(options, 'highpass', filterId, true);
      break;
    default:
      break;
  }
}
function matlabFilter(options, type, filterId, absValue) {
  var cutoff = options[filterId + '_cutoff'];
  var hidden = options[filterId + '_hidden'];

  var coeffs = MatLabUtil.calculateCoeffs(1, cutoff, 30, type);
  options.workingData = MatLabUtil.filtfilt(coeffs.b, coeffs.a, options.workingData);
  if (absValue) {
    options.workingData = options.workingData.map(function (mag) {
      return Math.abs(mag);
    });
  }

  options.data.push({
    name: 'Filter - Matlab ' + type,
    x: options.data[0].x,
    y: options.workingData,
    visible: hidden ? 'legendonly' : true
  });
  //return filtered;
}
