function assert(condition, message) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

function _defaultErrorHandler(endpoint, x, exception, errorThrown) {
    var message;
    var statusErrorMap = {
        '400' : "Server understood the request but request content was invalid.",
        '401' : "Unauthorised access.",
        '403' : "Forbidden resouce can't be accessed",
        '500' : "Internal Server Error.",
        '503' : "Service Unavailable"
    };
    if (x && x.status) {
        message =statusErrorMap[x.status];
                        if(!message){
                              message="Unknow Error \n.";
                          }
    } else if(exception=='parsererror'){
        message = "Error.\nParsing JSON Request failed.";
    } else if(exception=='timeout'){
        message = "Request Time out.";
    } else if(exception=='abort'){
        message = "Request was aborted by the server";
    } else if(exception.match("^JSON\-RPC Error:")) {
        message = exception;
    } else {
        message = "Unknown Error.";
    }
    
    bootbox.alert("Error making request to " + endpoint + ": " + message);
}  

function fetchData(url, onSuccess, onError, postdata, extraAJAXOpts, useYQL, _url_n) {
  if(typeof(onError)==='undefined' || onError == "default")
    onError = function(x, textStatus, errorThrown) { return _defaultErrorHandler(url, x, textStatus, errorThrown) };
  if(typeof(postdata)==='undefined') postdata = null;
  if(typeof(extraAJAXOpts)==='undefined') extraAJAXOpts = {};
  if(typeof(useYQL)==='undefined') useYQL = false;
  if(typeof(_url_n)==='undefined') _url_n = 0;

  if (useYQL) {
      // Some cross-domain magic (to bypass Access-Control-Allow-Origin)
      var q = 'select * from html where url="'+url+'"';
      if (postdata) {
          q = 'use "http://brainwallet.github.com/js/htmlpost.xml" as htmlpost; ';
          q += 'select * from htmlpost where url="' + url + '" ';
          q += 'and postdata="' + postdata + '" and xpath="//p"';
      }
      url = 'https://query.yahooapis.com/v1/public/yql?q=' + encodeURIComponent(q);
  }
  
  //if passed a list of urls for url, then keep trying until we find one that works
  var u = url;
  if (url instanceof Array) {
    u = url[_url_n];
  }
  
  var ajaxOpts = {
      type: (useYQL || !postdata) ? "GET" : "POST",
      data: (useYQL || !postdata) ? "" : postdata,
      //dataType: dataType, 
      url: url,
      success: function(res) {
        if(onSuccess) {
          if(extraAJAXOpts && extraAJAXOpts['dataType'] == 'json') {
            if(res.substring) res = $.parseJSON(res); 
            //^ ghetto hack...sometimes jquery does not parse the JSON response  

            if(res && res['result']) {
              onSuccess(res['result']);
            } else {
              onError(null, "JSON-RPC Error: "
                + "<p><b>Type:</b> " + res['error']['message'] + "</p>"
                + "<p><b>Code:</b> " + res['error']['code'] + "</p>"
                + "<p><b>Message:</b> " + res['error']['data']['message'] + "</p>"
                /*+ "<p><b>RAW:</b> " + JSON.stringify(res) + "</p>"*/, null);
            }
          } else {
            onSuccess(useYQL ? $(res).find('results').text() : res.responseText);
          }
        }
      },
      error:function (xhr, opt, err) {
        if (url instanceof Array) {
          if(url.length <= _url_n + 1) {
            //no more urls to hit...finally call error callback (if there is one)
            if (onError) 
              return onError(xhr, opt, err);
          } else {
            //try the next URL
            return fetchData(url, onSuccess, onError, postdata, extraAJAXOpts, useYQL, _url_n + 1);
          }
        }
      }
  }
  if(extraAJAXOpts) {
    for (var attrname in extraAJAXOpts) { ajaxOpts[attrname] = extraAJAXOpts[attrname]; }
  }
  $.ajax(ajaxOpts);
}

function makeJSONAPICall(dest, method, params, onSuccess, onError) {
  if(typeof(onError)==='undefined')
    onError = function(x, textStatus, errorThrown) { return _defaultErrorHandler(method + "@" + dest, x, textStatus, errorThrown) };
  if(dest != "counterwalletd" && dest != "counterpartyd") { alert("Invalid dest!"); }
  if(typeof(onError)==='undefined') onError = alertModal; //just default to popping up a modal with the error for now...
  
  var urls = counterwalletd_api_urls;
  
  //make JSON API call to counterwalletd
  if(dest == "counterwalletd") {
    fetchData(urls, onSuccess, onError,
      JSON.stringify({"jsonrpc": "2.0", "id": 0, "method": method, "params": params}),
      { contentType: 'application/json; charset=utf-8',
        dataType:"json",
      }
    );
  } else if(dest == "counterpartyd") {
    //make JSON API call to counterwalletd, which will proxy it to counterpartyd
    fetchData(urls, onSuccess, onError,
      JSON.stringify({
        "jsonrpc": "2.0", "id": 0,
        "method": "proxy_to_counterpartyd",
        "params": {"method": method, "params": params }
      }),
      {
        contentType: 'application/json; charset=utf-8',
        dataType:"json"
      }
    );
  } else {
    alert("Unknown API call dest: " + dest);
  }
}

function makeQRCode(addr) {
  var qr = qrcode(3, 'M');
  addr = addr.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
  qr.addData(addr);
  qr.make();
  return qr.createImgTag(4);
}

function toFixed(value, precision) {
  //output a floating point at a given max precision (http://stackoverflow.com/a/661757)
  var power = Math.pow(10, precision || 0);
  return String(Math.round(value * power) / power);
}

function numberWithCommas(x) {
  //print a number with commas, as appropriate (http://stackoverflow.com/a/2901298)
  var parts = x.toString().split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

function isNumber(n) {
  return !isNaN(parseFloat(n)) && isFinite(n);
}

function selectText(element) {
    var doc = document
        , text = doc.getElementById(element)
        , range, selection
    ;    
    if (doc.body.createTextRange) { //ms
        range = doc.body.createTextRange();
        range.moveToElementText(text);
        range.select();
    } else if (window.getSelection) { //all others
        selection = window.getSelection();        
        range = doc.createRange();
        range.selectNodeContents(text);
        selection.removeAllRanges();
        selection.addRange(range);
    }
}

/* Knockout bindings */
ko.bindingHandlers.isotope = {
    init: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
      //HACK: isotope is initialized in getBalances
     
    },
    update: function (element, valueAccessor, allBindingsAccessor, viewModel, bindingContext) {
        var $el = $(element),
            value = ko.utils.unwrapObservable(valueAccessor());

        if ($el.hasClass('isotope')) {
            $el.isotope('reLayout');
        } else {
            $el.isotope({
                itemSelector: value.itemSelector
            });
        }
    }
};

ko.bindingHandlers.showModal = {
  init: function (element, valueAccessor) {
  },
  update: function (element, valueAccessor) {
    var value = valueAccessor();
    if (ko.utils.unwrapObservable(value)) {
      $(element).modal('show');
                          // this is to focus input field inside dialog
      $("input", element).focus();
    }
    else {
      $(element).modal('hide');
    }
  }
};

ko.bindingHandlers.timeago = {
  //http://stackoverflow.com/a/11270500
  update: function(element, valueAccessor) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    var $this = $(element);

    // Set the title attribute to the new value = timestamp
    $this.attr('title', value);

    // If timeago has already been applied to this node, don't reapply it -
    // since timeago isn't really flexible (it doesn't provide a public
    // remove() or refresh() method) we need to do everything by ourselves.
    if ($this.data('timeago')) {
      var datetime = $.timeago.datetime($this);
      var distance = (new Date().getTime() - datetime.getTime());
      var inWords = $.timeago.inWords(distance);

      // Update cache and displayed text..
      $this.data('timeago', { 'datetime': datetime });
      $this.text(inWords);
    } else {
      // timeago hasn't been applied to this node -> we should do that now
      $this.timeago();
    }
  }
};