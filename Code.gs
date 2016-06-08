var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
var sheets = spreadsheet.getSheets();

var userProperties = PropertiesService.getUserProperties();

var storedata = sheets[1];

function userAlert(running) {
  // Inform users when script is refreshing
  
  var sheet = sheets[0];
  var text = "Script is currently refreshing data, please wait...";
  
  // Check if one is already there and remove
  if (sheet.getRange(1,1).getValue() == text) {
    sheet.deleteRow(1);
  }
  
  // Insert notice
  if (running) {
    sheet.insertRowBefore(1);
    var cell = sheet.getRange(1, 1, 1, sheets.length + 2);
    cell.mergeAcross();
    cell.setValue(text);
    cell.setHorizontalAlignment("center");
    cell.setVerticalAlignment("middle")
    cell.setBackground("black");
    cell.setFontColor("white");
    cell.setFontSize(18);
    
    sheet.setRowHeight(1, 100);
  }
}

function updateUserSheets() {  
  userAlert(true);
  
  // Only do one sheet a run to prevent script timeouts
  var lastSheetWorked = parseInt(userProperties.getProperty("lastSheetWorked"));
  
  // Flip back to beginning
  if (isNaN(lastSheetWorked) || lastSheetWorked >= sheets.length - 1) {
    lastSheetWorked = 1; // We want to ignore sheets 0 and 1
  }
  
  var i = lastSheetWorked + 1;
  
  updateUserSheet(i);
  
  // If this is the last sheet, update appIDs on store data sheet
  if (i >= sheets.length - 1) {
    addNewAppIDs();
  }
  
  userProperties.setProperty("lastSheetWorked", i);
  userAlert(false);
}

// Should only be run in browser
function updateAllUserSheets() {
  userAlert(true);
  
  // Only do one sheet a run to prevent script timeouts
  var lastSheetWorked = parseInt(userProperties.getProperty("lastSheetWorked"));
  
  // Flip back to beginning
  if (isNaN(lastSheetWorked) || lastSheetWorked >= sheets.length - 1) {
    lastSheetWorked = 1; // We want to ignore sheets 0 and 1
  }
  
  for (var i = lastSheetWorked + 1; i < sheets.length; i++) {
    updateUserSheet(i);
    userProperties.setProperty("lastSheetWorked", i);
  }
  
  // If this is the last sheet, update appIDs on store data sheet
  if (i >= sheets.length - 1) {
    addNewAppIDs();
  }
  
  userAlert(false);
}

// Helper function
function updateUserSheet(i) {
  var sheet = sheets[i];
  var userid = sheet.getName();
  var steamurl = "http://steamcommunity.com/id/" + userid + "/games?xml=1";
  
  var xml = UrlFetchApp.fetch(steamurl).getContentText();
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
      Logger.log(game);
      
      for (p = 0; p < columns.length; p++) {
        data[p] = game.getChildText(columns[p]);
      }
      
      sheet.appendRow(data);
    }
    
    // Freeze first row
    sheet.setFrozenRows(1);
    
    // Sort in ascending order by app ID
    var range = sheet.getRange(2, 1, sheet.getMaxRows() - 1, sheet.getMaxColumns());
    range.sort({column: 1, ascending: true});
  }
}

// Helper function
function addNewAppIDs() {
  // Get a list of all user sheet appIDs
  var appIDs = [];
  for (i = 2; i < sheets.length; i++) {
    var sheet = sheets[i];
    var range = sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1);
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

function updateStoreData() {
  userAlert(true);
  
  // Range of app IDs
  var range = storedata.getRange(2, 1, storedata.getMaxRows() - 1, storedata.getMaxColumns());
  
  for (i = 1; i <= range.getHeight(); i++) {
    // Continue if there's no data in the second column
    if (range.getCell(i, 2).isBlank()) {
      var appID = range.getCell(i, 1).getValue();
      var steamurl = "http://store.steampowered.com/api/appdetails/?appids=" + appID + "&cc=US&l=english&v=1";
      
      var options = {
        "muteHttpExceptions" : true
      };
      var fetch = UrlFetchApp.fetch(steamurl, options);
      
      if (fetch.getResponseCode() == 429) {
        // 429 Too Many Requests
        Logger.log("Rate limited for appID " + appID);
        userAlert(false);
        return;
      }
      
      var json = fetch.getContentText();
      var doc = JSON.parse(json);
      
      // Columns we use:
      // type, name, detailed_description, about_the_game, header_image, metacritic, platforms, categories, genres, background
      // metacritic is an object with score and url
      // platforms is an object with windows, mac, and linux
      // categories and genres are arrays with objects with id and description
      
      
      if (doc[appID] == null) {
        Logger.log("Steam API failed for appID " + appID);
        // Stop in case the service is down or we're rate limited
        userAlert(false);
        return;
      }
      
      if (!doc[appID].success) {
        Logger.log("Success = false for appID " + appID);
        // idk, some appIDs just don't work
        continue;
      }
      
      var data = doc[appID].data;
      
      var row = [data.type, data.name, data.detailed_description, data.about_the_game, data.header_image];
      if (data.metacritic) {
        row.push(data.metacritic.score);
      } else {
        row.push(null);
      }
      
      var platforms = [];
      if (data.platforms.windows) {
        platforms.push("windows");
      }
      if (data.platforms.mac) {
        platforms.push("mac");
      }
      if (data.platforms.linux) {
        platforms.push("linux");
      }
      row.push(platforms.join(","));
      
      var categories = [];
      if (data.categories) {
        for (k = 0; k < data.categories.length; k++) {
          categories.push(data.categories[k].description);
        }
        row.push(categories.join(","));
      } else {
        // 21979 doesn't have categories
        row.push(null);
      }
      
      var genres = [];
      if (data.genres) {
        for (k = 0; k < data.genres.length; k++) {
          genres.push(data.genres[k].description);
        }
        row.push(genres.join(","));
      } else {
        // 71250 doesn't have genres
        row.push(null);
      }
      
      row.push(data.background);
      
      // Now edit the row by looping through cells
      for (k = 0; k < row.length; k++) {
        range.getCell(i, k + 2).setValue(row[k]);
      }
      
      Logger.log("Updated appID " + appID);
    }
  }
  
  userAlert(false);
}
