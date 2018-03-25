# GATrack.gs - a Google Analytics helper for Google Apps Script

GATrack is a Google Apps Script helper class which makes it easy to integrate Google Analytics tracking in your script project. Using the [Google Analytics Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/v1/) GATrack allows you to send any of the Google Analytics hit types during your script execution. Using the batch and queue time features of the Google Analytics Measurement Protocol GA Track minimises `UrlFetchApp` calls whilst also removing any latency in the hit data.

## Google Sheets Add-on Example

So how do we pull all of this together into a reusable pattern. In this GitHub repo a simply Google Sheets Add-on which integrates Google Analytics in `HtmlService` and server side. All the code is also [available in this script project](https://script.google.com/d/1PBj10gyUC0NBOBOzWk2tA9XN2pLi4uJm43Y2C2NVlPXLQhB82ONMdB39/edit?usp=drive_web) to make it easier for you to copy and test.

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
## GATrack and doNotTrack

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
