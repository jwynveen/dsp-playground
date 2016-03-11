$(function () {
  $('[type=file]').on('change', function () {
    $('form').submit();
  });

  var $chart = $('#chart');
  if ($chart.data('values')) {
    Plotly.plot('chart', $chart.data('values'), {margin: {t: 0}});
  }

  $('select[data-value]').each(function (idx, el) {
    const $el = $(el);
    if ($el.data('value')) {
      $('option[value="' + $el.data('value') + '"]', $el).attr('selected', true);
    }
  });
});
