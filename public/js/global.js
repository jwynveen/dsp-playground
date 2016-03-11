$(function () {
  $('[type=file]').on('change', function () {
    $('form').submit();
  });

  var $chart = $('#chart');
  if ($chart.data('values')) {
    Plotly.plot('chart', $chart.data('values'), {margin: {t: 0}});
  }
});
