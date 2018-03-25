# GATrack.gs - a Google Analytics helper for Google Apps Script

GATrack is a Google Apps Script helper class which makes it easy to integrate Google Analytics tracking in your script project. Using the [Google Analytics Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/v1/) GATrack allows you to send any of the Google Analytics hit types during your script execution. Using the batch and queue time features of the Google Analytics Measurement Protocol GA Track minimises `UrlFetchApp` calls whilst also removing any latency in the hit data.

## Google Sheets Add-on Example

So how do we pull all of this together into a reusable pattern. In this GitHub repo a simply Google Sheets Add-on which integrates Google Analytics in `HtmlService` and server side. All the code is bound to [this copy of a Google Sheet](https://docs.google.com/spreadsheets/d/1Cks_SMXTvCFgQgrGBflH_o6xcQg-4Ru-SGotnZeKrNQ/copy) to make it easier for you to test.

In the example we are interacting with a third party API to pull back a random list of names. The example highlights some basic Google Analytics tracking techniques. The code includes a `GATrack.gs` helper which you can drop into your existing and new script projects.    

## Setting up GATrack

To use GATrack in your own script project once `GATrack.gs` is copied you need to initialize it with your Google Analytics tracking ID, and optional User ID by calling:

`GATrack.init(TID, optUID);`

As GATrack uses a number of services such as Property Service and UrlFetchApp if you are using this in an Add-on and initializing in onOpen() you need to [handle this based on authorization mode](https://developers.google.com/apps-script/add-ons/lifecycle#opening), for example :      

```
function onOpen(e) {
  var menu = SpreadsheetApp.getUi().createAddonMenu();
  if (e && e.authMode !== ScriptApp.AuthMode.NONE) {
    // As using Properties service and UrlFetchApp can only run when not in AuthMode.NONE
    GATrack.init('UA-48225260-5', Session.getTemporaryActiveUserKey());
    menu.addItem('Show Sidebar', 'showSidebar');
  } else {
    // Add a normal menu item (works in all authorization modes).
  }
  menu.addToUi();
}
```

## Building Google Analytics hits in your server side code

To build hits for your Google Analytics account you use the `addToGA()` method:

`GATrack.addToGA(hitsObject);`

The `hitsObject` is deliberately abstract to give you  complete flexibility in the hit you send. For example, to send an event hit type you could use:

`GATrack.addToGA({t: 'event', ec: 'GATrackDemo', ea: 'Name Gen.', el: 'Name Length', ev: 1});`

Or a timing hit with:

`GATrack.addToGA({t: 'timing', utc: 'GATrackDemo', utv: 'runtime', utt:time, utl:'Name Gen.' });`

You can keep adding Google Analytics hits throughout your script execution. If you add more than 20 hits GATrack will automatically send the queued data to Google Analytics allowing you to keep adding hits. All hits you add are also automatically timestamped so that their is no latency in the data.

## Flushing Google Analytics hits at the end of script execution

To flush any remaining queued hits you need to include the following line at the end of your script execution:

`GATrack.flushGAQueue();`

This is very important to do otherwise to you do as queued data is not persistent and is only stored for the duration of the script execution. If you are also using try/catch and still want to send data when there is an exception remember to include `.flushGAQueue()`. Google Analytics also has an exceptions hit type and the following code is used in the example:

```
function getLotsOfThings(){
  // ...
  try {
    // ...
    GATrack.addToGA(...);
    GATrack.flushGAQueue();
  } catch(e) {
    GATrack.addToGA({t: 'exception', exd: 'Line '+e.lineNumber+' '+e.message});
    GATrack.flushGAQueue();
  }
}   
```
## GATrack and `doNotTrack`

GATrack also includes a `.setDoNotTrack()` method which allows your users to opt out of Google Analytics tracking:

`GATrack.setDoNotTrack(true);`

The setting is stored in Property Service as a User Property so it has persistence outwith a single script execution. GATrack doesn’t implement any UI so it is up to you to decide how to record user preferences. GATrack does however expose `.setDoNotTrack()` so that it can be used within  a HtmlService interface with:

`google.script.run.expose('GATrack','setDoNotTrack', true );`

Within `HtmlService` this can be combined with `Navigator.doNotTrack` as the example below demonstrates:

```
<!-- Global site tag (gtag.js) - Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=UA-48225260-5"></script>
<script>
  // Respect do not track for all browsers. Except for IE 10 and 11 where we ignore it
  // https://hjnilsson.com/2015/11/30/setting-up-dnt/
  var dnt_isIe10or11 = (navigator.appVersion.indexOf("MSIE 10") !== -1) || (navigator.userAgent.indexOf("Trident") !== -1 && navigator.userAgent.indexOf("rv:11") !== -1);
  var DNT = (navigator.doNotTrack || navigator.msDoNotTrack || window.doNotTrack);
  DNT = !DNT || DNT == "unspecified" || DNT == "0" ? false : true;
  if (!DNT || dnt_isIe10or11) {
    // do track
    google.script.run.expose('GATrack','setDoNotTrack', '' );
  } else {
    // don't track
    window['ga-disable-YOUR_TRACKING_ID_HERE'] = true;
    google.script.run.expose('GATrack','setDoNotTrack', true );
  }

  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'YOUR_TRACKING_ID_HERE',{
    'page_title': GA.page_title,
    'page_location': GA.page_url,
    'user_id': GA.user_id
  });
</script>
```
## GATrack.gs
```
// Developed by mhawksey
// https://github.com/mhawksey/GATrack/blob/master/LICENSE
var GATrack = (function (ns) {

  // Globals
  var GA_BATCH = [];
  var TRACKING_KEY = 'GATrack_Pref';

  /*
  * Initialize with Google Analytics Tracking ID / Web Property ID.
  * @param {string} TID of Tracking ID / Web Property ID
  * @param {string} optUID setting optional User ID
  */
  ns.init = function (TID, optUID) {
    ns.setProp_('TID',TID);
    ns.setProp_('UID',optUID || '');
  };

  /*
  * Build data to send Google Analytics Measurement Protocol.
  * @param {Object} hitsObject to queue for Google Analytics
  */
  ns.addToGA = function (hitsObject){
    var base = {v:   '1',
                tid: ns.getProp_('TID')};

    if (ns.getProp_('UID')){
      base.uid = ns.getProp_('UID');
    }

    // merge hitsObject with base
    // https://stackoverflow.com/a/171256
    for (var a in base) {
      hitsObject[a] = base[a];
    }
    // turn obejct into querystring
    var payload = Object.keys(hitsObject).map(function(key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(hitsObject[key]);
    }).join('&');
    addToGABatch_(payload, new Date());
    // Uncomment the next line if you want to view what is being sent to GA in Stackdriver Logging
    // [As the measurement protocol returns no error for invalid hits the test_url can be used to validate]
    // console.log({call: 'addToGa',data:payload, test_url: 'https://ga-dev-tools.appspot.com/hit-builder/?'+payload});
  }

  /*
  * Adds our GA call to a queue and sends when it hits 20
  * @param {string} query for event to track
  * @param {Date} date of event to track
  */
  function addToGABatch_(query, date){
    GA_BATCH.push({query: query, time:date});
    if (GA_BATCH.length >= 20){
      ns.flushGAQueue();
    }
  }

  /*
  * Send data to GA from queue
  */
  ns.flushGAQueue = function (){
    // check tracking pref
    var doNotTrack = ns.getDoNotTrack();
    if (!doNotTrack){
      var payload = "";
      var ga_now = new Date().getTime();
      // build payload
      for (var i=0; i < GA_BATCH.length; i++){
        payload += GA_BATCH[i].query + "&qt=" + (ga_now - GA_BATCH[i].time) + "\n";
      }
      var options = {'method' : 'POST',
                     'payload' : payload };
      var rep_code = UrlFetchApp.fetch('https://www.google-analytics.com/batch', options).getResponseCode();
      if (rep_code < 200 || rep_code > 299){
        console.error({call: 'GATrack', error:rep_code});
      }
      GA_BATCH = [];
    }
  }

  /**
  * Gets tracking pref using caching.
  * @returns {Boolean} tracking pref.
  */
  ns.getDoNotTrack = function (){
    return ns.getProp_(TRACKING_KEY) == 'true'
  }

  /**
  * Sets tracking pref using caching.
  */
  ns.setDoNotTrack = function(pref){
    ns.setProp_(TRACKING_KEY, pref);
  }

  /**
  * Sets a static user property, using caching.
  * @param {string} key The property key.
  * @param {string} value The property value.
  */
  ns.setProp_ = function (key, value){
    PropertiesService.getUserProperties().setProperty(key, value);
    CacheService.getUserCache().put(key, value, 86400);
  }

  /**
  * Gets a static document property, using caching.
  * @param {string} key The property key.
  * @returns {string} The property value.
  */
  ns.getProp_ = function(key){
    var value = CacheService.getUserCache().get(key);
    if (!value){
      var value = PropertiesService.getUserProperties().getProperty(key);
      CacheService.getUserCache().put(key, value, 86400);
    }
    return value;
  }
  return ns;
})(GATrack || {});

// Expose Namespace methods for google.script.run
// http://ramblings.mcpher.com/Home/excelquirks/gassnips/exposeserver
function expose (namespace , method) {
  return this[namespace][method].apply(this,Array.prototype.slice.call(arguments,2));
}
```
