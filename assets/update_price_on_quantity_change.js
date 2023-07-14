(function () {
  var moneyFormat = "{{amount_with_comma_separator}} €";
  function formatMoney(cents, format) {
    if (typeof cents == 'string') { cents = cents.replace('.', ''); }
    var value = '';
    var placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
    var formatString = (format || moneyFormat);

    function defaultOption(opt, def) {
      return (typeof opt == 'undefined' ? def : opt);
    }

    function formatWithDelimiters(number, precision, thousands, decimal) {
      precision = defaultOption(precision, 2);
      thousands = defaultOption(thousands, ',');
      decimal = defaultOption(decimal, '.');

      if (isNaN(number) || number == null) { return 0; }

      number = (number / 100.0).toFixed(precision);

      var parts = number.split('.'),
        dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands),
        cents = parts[1] ? (decimal + parts[1]) : '';

      return dollars + cents;
    }

    switch (formatString.match(placeholderRegex)[1]) {
      case 'amount':
        value = formatWithDelimiters(cents, 2);
        break;
      case 'amount_no_decimals':
        value = formatWithDelimiters(cents, 0);
        break;
      case 'amount_with_comma_separator':
        value = formatWithDelimiters(cents, 2, '.', ',');
        break;
      case 'amount_no_decimals_with_comma_separator':
        value = formatWithDelimiters(cents, 0, '.', ',');
        break;
    }

    return formatString.replace(placeholderRegex, value);
  };

  function updatePriceWithQuantity() {
    var priceElement = document.querySelector(".price__container [data-price]");
    var quantityElement = document.querySelector("quantity-input .quantity__input");
    
    if(!priceElement || !quantityElement) { return }
    
    var priceCents = parseInt(priceElement.dataset.price);
    var quantity = parseInt(quantityElement.value);
    if(quantity <= 0) {
      quantity = 1;
    }
    var newPrice = priceCents * quantity;
    
    if(!Number.isFinite(newPrice)) { return }
    
    var formattedPrice = formatMoney(newPrice);
    
    priceElement.innerText = formattedPrice;
  }

  document.addEventListener('DOMContentLoaded', function() {
    document.querySelector("quantity-input .quantity__input").addEventListener('change', updatePriceWithQuantity);

    updatePriceWithQuantity();
  });

  window.Tolingo = window.Tolingo || {};
  window.Tolingo.updatePriceWithQuantity = updatePriceWithQuantity;
})();
