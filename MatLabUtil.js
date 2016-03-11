/**
 * Translated from MatLab's filtfilt method. Only the portions needed
 * are implemented since the MatLab function is quite robust.
 */
module.exports = {

  filtfilt: function (b, a, x) {
    try {
      var arrX = x.slice(0); // clone the array so we don't edit original
      var npts = arrX.length;
      var y = [];

      var coeffs = this.getCoeffsAndInitialConditions(b, a, npts);
      var zi = coeffs.zi;
      var nfact = coeffs.nfact;
      var L = coeffs.L;

      if (npts < 10000) {
        y = this.ffOneChanCat(coeffs.b, coeffs.a, arrX, zi, nfact, L);
      } else {
        y = this.ffOneChan(coeffs.b, coeffs.a, arrX, zi, nfact, L);
      }
      return y;
    } catch (ex) {
      return new Array(x.length);
    }
  },

  getCoeffsAndInitialConditions: function (b, a) {
    var L = b.length;

    var na = a.length;

    // This skips the entire isSOS logic from matlab

    // Check coefficients
    L = 1;
    var nb = b.length;
    var nfilt = Math.max(nb, na);
    var nfact = Math.max(1, 3 * (nfilt - 1));

    // Zero pad shorter coefficient vector as needed
    if (nb < nfilt) {
      b[nfilt - 1] = 0;
    } else if (na < nfilt) {
      a[nfilt - 1] = 0;
    }

    // Compute initial conditions to remove DC offset at beginning and end of
    // filtered sequence.  Use sparse matrix to solve linear system for initial
    // conditions zi, which is the vector of states for the filter b(z)/a(z) in
    // the state-space formulation of the filter.
    var zi;
    if (nfilt > 1) {
      // todo: a bunch of array operations, it looks like
      zi = -1;
    } else {
      zi = [0];
    }

    return {
      b: b,
      a: a,
      zi: zi,
      nfact: nfact,
      L: L
    };
  },

  ffOneChanCat: function (b, a, y, zi, nfact, L) {
    var result = y.slice();
    for (var i = 0; i < L; i++) {
      // Single channel, data explicityly concatenated into one vector
      // todo: below assumes nfact=3
      result.splice(0, 0,
        2 * result[0] - result[nfact],
        2 * result[0] - result[nfact - 1],
        2 * result[0] - result[nfact - 2]
      );
      var lastIdx = result.length - 1;
      result.push(
        2 * result[lastIdx] - result[lastIdx - 1],
        2 * result[lastIdx] - result[lastIdx - 2],
        2 * result[lastIdx] - result[lastIdx - 3]
      );
      // filter, reverse data, filter again, and reverse data again
      result = this.filter(b, a, result, (zi || 0) * result[0]);
      result = result.reverse();
      result = this.filter(b, a, result, (zi || 0) * result[0]);

      // retain reversed central section of y
      result = result.slice(nfact - 1, result.length - nfact).reverse();
    }
    return result;
  },
  /* ffOneChan(b, a, x, zi, nfact, L) {
   // todo
   }*/
  filter: function (b, a, x, zi) {
    var y = new Array(x.length);
    for (var i = 0; i < y.length; i++) {
      if (i === 0) {
        y[i] = b[0] * x[i] + (zi || 0);
      } else {
        y[i] = b[0] * x[i] + b[1] * x[i - 1] - a[1] * y[i - 1];
      }
    }
    return y;
  },

  calculateCoeffs: function (n, cutoff, sample, type) {
    // http://www.exstrom.com/journal/sigproc/
    return {
      b: this.coeffB(n, cutoff, sample, type),
      a: this.coeffA(n, cutoff, sample)
    };
  },

  coeffA: function (n, cutoff, sample) {
    var fcf = cutoff / sample;

    var rcof = new Array(2 * n);
    var theta = Math.PI * fcf;
    var st = Math.sin(theta);
    var ct = Math.cos(theta);

    for (var i = 0; i < n; i++) {
      var parg = Math.PI * (2 * i + 1) / (2 * n);
      var sparg = Math.sin(parg);
      var cparg = Math.cos(parg);
      var a = 1 + st * sparg;
      rcof[2 * i] = -ct / a;
      rcof[2 * i + 1] = -st * cparg / a;
    }

    var dcof = binomialMult(n, rcof);
    dcof[1] = dcof[0];
    dcof[0] = 1;
    for (var k = 3; k <= n; k++) {
      dcof[k] = dcof[2 * k - 2];
    }
    return dcof;
  },

  coeffB: function (n, cutoff, sample, type) {
    var a = this.coeffA(n, cutoff, sample);
    var b = [1, 1];
    if (type === 'highpass') {
      b = [1, -1];
    }
    return vectorScalarMultiply(
      vectorScalarMultiply(b,
        dotProduct(b, a)),
      1 / dotProduct(b, b)
    );
  }
};

function binomialMult(n, p) {
  var a = new Array(2 * n);
  for (var i = 0; i < n; i++) {
    for (var j = i; j > 0; j--) {
      a[2 * j] = (a[2 * j] || 0) + p[2 * i] * a[2 * (j - 1)] - p[2 * i + 1] * a[2 * (j - 1) + 1];
      a[2 * j + 1] = (a[2 * j + 1] || 0) + p[2 * i] * a[2 * (j - 1) + 1] + p[2 * i + 1] * a[2 * (j - 1)];
    }
    a[0] = (a[0] || 0) + p[2 * i];
    a[1] = (a[1] || 0) + p[2 * i + 1];
  }
  return a;
}
function dotProduct(a, b) {
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result += a[i] * b[i];
  }
  return result;
}
function vectorScalarMultiply(vector, scalar) {
  var result = [];
  for (var i = 0; i < vector.length; i++) {
    result.push(vector[i] * scalar);
  }
  return result;
}
