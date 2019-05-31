
function userAlert(running) {
  // Inform users when script is refreshing
  Logger.log("Setting userAlert banner to running = %s", running);
  
  var text = "Script is currently refreshing data, please wait...";
  
  // Check if one is already there and remove
  if (filterAlertSheet.getRange(1,1).getValue() == text) {
    filterAlertSheet.deleteRow(1);
  }
  
  // Insert notice
  if (running) {
    filterAlertSheet.insertRowBefore(1);
    var cell = filterAlertSheet.getRange(1, 1, 1, filterAlertSheet.getLastColumn());
    cell.mergeAcross();
    cell.setValue(text);
    cell.setHorizontalAlignment("center");
    cell.setVerticalAlignment("middle")
    cell.setBackground("black");
    cell.setFontColor("white");
    cell.setFontSize(18);
    
    filterAlertSheet.setRowHeight(1, 100);
  }
}


function updateUserSheet(i) {
  var sheet = userSheets[i];
  var userid = sheet.getName();
  var steamurl = "http://steamcommunity.com/id/" + userid + "/games?xml=1";
  
  var options = {
    "muteHttpExceptions" : true
  };
  var fetch = UrlFetchApp.fetch(steamurl, options);
  
  if (fetch.getResponseCode() == 429) {
    // 429 Too Many Requests
    Logger.log("Rate limited for user " + userid);
    return;
  }
  
  var xml = fetch.getContentText();
  var doc = XmlService.parse(xml);
  
  // XML tree:
  // gamesList
  // - steamID64
  // - steamID
  // - games
  // -- game
  // --- appID
  // --- name
  // --- logo
  // --- storeLink
  // --- hoursLast2Weeks
  // --- hoursOnRecord
  // --- statsLink
  // --- globalStatsLink
  var columns = ["appID", "name", "logo", "storeLink", "hoursLast2Weeks", "hoursOnRecord", "statsLink", "globalStatsLink"];
  
  var games = doc.getRootElement().getChild("games").getChildren();
  if (games != null) {
    // Remove frozen rows
    sheet.setFrozenRows(0);
    
    // Delete every row except the first since we have to have one
    if (sheet.getMaxRows() > 1) {
      sheet.deleteRows(2, sheet.getMaxRows() - 1);
    }
    
    // Create header row
    sheet.appendRow(columns);
    
    // Delete first row, leaving header
    sheet.deleteRow(1);
    
    for (k = 0; k < games.length; k++) {
      var game = games[k];
      var data = [];
      //Logger.log(game);
      
      for (p = 0; p < columns.length; p++) {
        data[p] = game.getChildText(columns[p]);
      }
      
      sheet.appendRow(data);
    }
    
    // Freeze first row
    try {
      sheet.setFrozenRows(1);
    
      // Sort in ascending order by app ID
      var range = sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getMaxColumns());
      range.sort({column: 1, ascending: true});
    }
    catch(err) {
      Logger.finer("Ignoring updateUserSheet error " + err)
    }
  }
}

// Adds just the newest app IDs from the user sheets to the Store Data page
function addNewAppIDs() {
  // Get a list of all user sheet appIDs
  var appIDs = [];
  for (i = 0; i < userSheets.length; i++) {
    var sheet = userSheets[i];
    var range = sheet.getRange(2, 1, sheet.getMaxRows(), 1);
    var values = range.getValues();
    for (k = 0; k < values.length; k++) {
      appIDs.push(values[k][0]);
    }
  }
  
  // Get a list of the Store Data sheet appIDs
  var currentAppIDs = [];
  var range = storedata.getRange(2, 1, storedata.getMaxRows() - 1, 1);
  var values = range.getValues();
  for (i = 0; i < values.length; i++) {
    currentAppIDs.push(values[i][0]);
  }
  
  // Compare
  for (i = 0; i < appIDs.length; i++) {
    if (currentAppIDs.indexOf(appIDs[i]) == -1) {
      // Add it to our in-memory array and the sheet
      currentAppIDs.push(appIDs[i]);
      storedata.appendRow([appIDs[i]]);
    }
  }
  
  // Sort by first column
  var range = storedata.getRange(2, 1, storedata.getMaxRows() - 1, storedata.getMaxColumns());
  range.sort({column: 1, ascending: true});
}
