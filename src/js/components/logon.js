
function LogonViewModel() {
  //JS used when the user is not yet logged on
  var self = this;

  self.enteredPassphrase = ko.observable('');
  self.generatedPassphrase = ko.observable('');
  self.walletGenProgressVal = ko.observable(0);

  self.walletGenProgressWidth = ko.computed(function(){
    return self.walletGenProgressVal() + '%';
  }, self);

  self.isPassphraseValid = ko.computed(function() {
    return self.enteredPassphrase().split(' ').length == 12;
  }, self);
  
  self.generatePassphrase = function() {
    //Generate (or regenerate) a random, new passphrase
    var pk = new Array(32);
    rng_get_bytes(pk);
    var seed = Crypto.util.bytesToHex(pk.slice(0,16));
    //nb! electrum doesn't handle trailing zeros very well
    // and we want to stay compatible.
    if (seed.charAt(0) == '0') seed = seed.substr(1);
    self.generatedPassphrase(mn_encode(seed));
  }
  
  self.showSecureKeyboard = function() {
    LOGON_PASSWORD_MODAL.show(); 
  }
  
  self.openWallet = function() {
    //Start with a gate check to make sure at least one of the servers is ready and caught up before we try to log in
    multiAPI("is_ready", [], function(data, endpoint) {
      assert(data['is_ready']); //otherwise we should have gotten a 525 error
      USE_TESTNET = data['testnet'];
      $.jqlog.log("Backend is ready. Testnet status: " + USE_TESTNET);

      //User is logging in...
      self.walletGenProgressVal(0); //reset so the progress bar hides again...
      $('#newAccountInfoPane').animate({opacity:0}); //fade out the new account pane if visible
      $('#createNewAcctBtnPane').animate({opacity:0}); //fade out the new account button pane if visible
      $('#extra-info').animate({opacity:0});
      
      //Initialize the socket.io data feed
      initDataFeed();
      
      //generate the wallet ID from a double SHA256 hash of the passphrase and the network (if testnet)
      WALLET.identifier(Crypto.util.bytesToBase64(Crypto.SHA256(
        Crypto.SHA256(self.enteredPassphrase() + (USE_TESTNET ? '_testnet' : ''),
        {asBytes: true}), {asBytes: true})));
      $.jqlog.log("My wallet ID: " + WALLET.identifier());
    
      //Grab preferences
      multiAPINewest("get_preferences", [WALLET.identifier()], 'last_updated', function(data) {
        var prefs = data && data.hasOwnProperty('preferences') ? data['preferences'] : null;
        if(prefs == null) {
          $.jqlog.log("Stored preferences NOT found on server(s). Creating new...");
          
          //no stored preferences on any server(s) in the federation, go with the default...
          prefs = {
            'num_addresses_used': WALLET.DEFAULT_NUMADDRESSES,
            'address_aliases': {}
          };
    
          //store the preferences on the server(s) for future use
          multiAPI("store_preferences", [WALLET.identifier(), prefs]);
        }
        PREFERENCES = prefs;
        
        //generate the appropriate number of addresses
        var seed = mn_decode(self.enteredPassphrase());
        Electrum.init(seed, function(r) {
            if(r % 20 == 0)
              self.walletGenProgressVal(r + 19);
          },
          function(privKey) {
            WALLET.ELECTRUM_PRIV_KEY = privKey;
            
            Electrum.gen(PREFERENCES['num_addresses_used'], function(r) { 
              WALLET.addKey(
                new Bitcoin.ECKey(r[1]),
                "My Address #" + (WALLET.addresses().length + 1).toString()
              );
              
              //$.jqlog.log("WALLET.addresses().length: " + WALLET.addresses().length);
              //$.jqlog.log("PREFERENCES.num_addresses_used: " + PREFERENCES.num_addresses_used);
              if(WALLET.addresses().length == PREFERENCES.num_addresses_used) {
                
                /* hide the login div and show the other divs */
                $('#logon').hide();
                $('#header').show();
                $('#left-panel').show();
                $('#main').show();
                
                //Update the wallet balances (isAtLogon = true)
                WALLET.updateBalances(true);
                
                //next, load the balances screen
                window.location.hash = 'xcp/pages/balances.html';
                return;
              }
            });
          }
        );
      });
    },
    function(jqXHR, textStatus, errorThrown, endpoint) {
      var message = describeError(jqXHR, textStatus, errorThrown);
      bootbox.alert("No counterparty servers are currently available. Please try again later. ERROR: " + message);
    });
  }
}

ko.validation.rules['isValidPassphrasePart'] = {
    validator: function (val, self) {
      return mn_words.contains(val);
    },
    message: 'Invalid phrase word.'
};
ko.validation.registerExtenders();

function LogonPasswordModalViewModel() {
  var self = this;
  self.shown = ko.observable(false);
  self.pwPart01 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart02 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart03 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart04 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart05 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart06 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart07 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart08 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart09 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart10 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart11 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  self.pwPart12 = ko.observable().extend({ required: true, isValidPassphrasePart: self });
  
  self.validationModel = ko.validatedObservable({
    pwPart01: self.pwPart01,
    pwPart02: self.pwPart02,
    pwPart03: self.pwPart03,
    pwPart04: self.pwPart04,
    pwPart05: self.pwPart05,
    pwPart06: self.pwPart06,
    pwPart07: self.pwPart07,
    pwPart08: self.pwPart08,
    pwPart09: self.pwPart09,
    pwPart10: self.pwPart10,
    pwPart11: self.pwPart11,
    pwPart12: self.pwPart12
  });
  
  self.dispFullPassphrase = ko.computed(function() {
    return [
      self.pwPart01(), self.pwPart02(), self.pwPart03(), self.pwPart04(),
      self.pwPart05(), self.pwPart06(), self.pwPart07(), self.pwPart08(),
      self.pwPart09(), self.pwPart10(), self.pwPart11(), self.pwPart12()
    ].join(' ');
  }, self);
  
  self.resetForm = function() {
    self.pwPart01('');
    self.pwPart02('');
    self.pwPart03('');
    self.pwPart04('');
    self.pwPart05('');
    self.pwPart06('');
    self.pwPart07('');
    self.pwPart08('');
    self.pwPart09('');
    self.pwPart10('');
    self.pwPart11('');
    self.pwPart12('');
    self.validationModel.errors.showAllMessages(false);
  }
  
  self.submitForm = function() {
    if (!self.validationModel.isValid()) {
      self.validationModel.errors.showAllMessages();
      return false;
    }    
    //data entry is valid...submit to trigger doAction()
    $('#logonPassphaseModal form').submit();
  }
  
  self.show = function(resetForm) {
    if(typeof(resetForm)==='undefined') resetForm = true;
    if(resetForm) self.resetForm();
    
    //TODO: choose a random X/Y coords for the modal
    
    $('#logonPassphaseModal input').click(function(e) {
      $(e.currentTarget).val(''); //clear the field on click
    });
    
    //Set up keyboard
    $('#logonPassphaseModal input').keyboard({
      display: {
        'bksp'   :  "\u2190",
        'accept' : 'Accept',
      },
      layout: 'custom',
      customLayout: {
        'default': [
          'q w e r t y u i o p {bksp}',
          'a s d f g h j k l',
          ' z x c v b n m {accept}'
        ],
      },
      autoAccept: true,
      usePreview: true,
      initialFocus : false,
      restrictInput: true,
      preventPaste: true
      /*acceptValue: true,
      validate: function(keyboard, value, isClosing) {
        return mn_words.contains(value);
      }*/
    }).autocomplete({
      source: mn_words
    }).addAutocomplete();
    
    // Overrides the default autocomplete filter function to search only from the beginning of the string
    $.ui.autocomplete.filter = function (array, term) {
        var matcher = new RegExp("^" + $.ui.autocomplete.escapeRegex(term), "i");
        return $.grep(array, function (value) {
            return matcher.test(value.label || value.value || value);
        });
    };    
    
    self.shown(true);
  }  

  self.hide = function() {
    self.shown(false);
  }
  
  self.doAction = function() {
    //simply fill in the data back into the passphrase field and close the dialog
    $('#password').val(self.dispFullPassphrase());
    self.resetForm(); //clear out the dialog too, for security
    self.shown(false);
    $('#open-sesame').click();
  }
}


var LOGON_VIEW_MODEL = new LogonViewModel();
var LOGON_PASSWORD_MODAL = new LogonPasswordModalViewModel();

$(document).ready(function() {
  ko.applyBindings(LOGON_VIEW_MODEL, document.getElementById("logon"));
  ko.applyBindingsWithValidation(LOGON_PASSWORD_MODAL, document.getElementById("logonPassphaseModal"));
});
