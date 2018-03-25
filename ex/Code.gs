// @OnlyCurrentDoc

function onOpen(e) {
  var menu = SpreadsheetApp.getUi().createAddonMenu();
  if (e && e.authMode !== ScriptApp.AuthMode.NONE) {
    // As using Properties service and URLFetchApp can only run when not in AuthMode.NONE
    GATrack.init('UA-48225260-5', Session.getTemporaryActiveUserKey());
    menu.addItem('Show Sidebar', 'showSidebar');
  } else {
    // Add a normal menu item (works in all authorization modes).
  }
  menu.addToUi();
}

function onInstall(e) {
  onOpen(e);
  // Perform additional setup as needed.
}

function showSidebar() {
  var doc = SpreadsheetApp.getActive();
  var html = HtmlService.createTemplateFromFile('ex/Page');
  html.ga = {page_title: doc.getName(),
             page_url: doc.getUrl(),
             user_id: Session.getTemporaryActiveUserKey()};
  SpreadsheetApp.getUi() // Or DocumentApp or FormApp.
      .showSidebar(html.evaluate());
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
      .getContent();
}

function getLotsOfThings(){
  var start = new Date();
  var request = 'http://faker.hook.io?property=name.findName';
  var requests = Array.apply(null, Array(25)).map(function(){return request});
  try {
    var names = UrlFetchApp.fetchAll(requests);
    names.forEach(function(i, idx){
      names[idx] = JSON.parse(i.getContentText());
      // GA Event Tracking
      // https://developers.google.com/analytics/devguides/collection/protocol/v1/devguide#event
      GATrack.addToGA({t: 'event', ec: 'GATrackDemo', ea: 'Name Gen.', el: 'Name Length', ev:names[idx].length});
    });
    var now = new Date().getTime();
    var time = now - start;
    // GA User Timing
    // https://developers.google.com/analytics/devguides/collection/protocol/v1/devguide#usertiming
    GATrack.addToGA({t: 'timing', utc: 'GATrackDemo', utv: 'runtime', utt:time, utl:'Name Gen.' });
    // flush any remaining GA hits
    GATrack.flushGAQueue();
    return names;
  } catch(e) {
    // GA Exception Tracking
    // https://developers.google.com/analytics/devguides/collection/protocol/v1/devguide#exception
    GATrack.addToGA({t: 'exception', exd: 'Line '+e.lineNumber+' '+e.message});
    GATrack.flushGAQueue();
  }
}
