// Global vars, leave alone
var spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
Logger = BetterLog.useSpreadsheet() 
var userProperties = PropertiesService.getUserProperties()

// The sheet where to place the filter alert
var filterAlertSheet = spreadsheet.getSheetByName("FILTER BABY FILTER")

// The sheet where user data starts (zero-indexed)
var userSheets = spreadsheet.getSheets().slice(3)

// The sheet the Store Data is on
var storedata = spreadsheet.getSheetByName("Store Data")

// Run on trigger every 2 hours
function updateUserSheets() {  
  Logger.log("Updating next user sheet")
  userAlert(true)
  
  // Only do one sheet a run to prevent script timeouts
  var lastSheetWorked = parseInt(userProperties.getProperty("lastSheetWorked"))
  
  //Logger.log("Last sheet worked index: %s", lastSheetWorked)
  
  // If the stored last sheet number is invalid, start at the first sheet
  if (isNaN(lastSheetWorked) || lastSheetWorked >= userSheets.length) {
    lastSheetWorked = 0
  }
  
  var i = lastSheetWorked + 1
  Logger.log("Next sheet index %s name %s", i, userSheets[i].getName())
  
  updateUserSheet(i)
  
  // If this is the last sheet, update appIDs on store data sheet
  if (i == userSheets.length - 1) {
    addNewAppIDs()
  }
  
  userProperties.setProperty("lastSheetWorked", i)
  userAlert(false)
}

// Should only be run in browser
function MANUAL_updateAllUserSheets() {
  // Just call the automatic function over and over, just like it was being called by the trigger
  for (var i = 0; i < userSheets.length; i++) {
    updateUserSheets()
  }
}

// Run on trigger once a day to load all missing store data
function updateStoreData() {
  userAlert(true)
  
  // Range of app IDs
  var range = storedata.getRange(2, 1, storedata.getMaxRows() - 1, storedata.getMaxColumns())
  
  for (i = 1; i <= range.getHeight(); i++) {
    // Continue if there's no data in the second column
    if (range.getCell(i, 2).isBlank()) {
      var appID = range.getCell(i, 1).getValue()
      var steamurl = "http://store.steampowered.com/api/appdetails/?appids=" + appID + "&cc=US&l=english&v=1"
      
      var options = {
        "muteHttpExceptions" : true
      }
      var fetch = UrlFetchApp.fetch(steamurl, options)
      
      if (fetch.getResponseCode() == 429) {
        // 429 Too Many Requests
        Logger.log("Rate limited for appID " + appID)
        userAlert(false)
        return
      }
      
      var json = fetch.getContentText()
      var doc = JSON.parse(json)
      
      // Columns we use:
      // type, name, detailed_description, about_the_game, header_image, metacritic, platforms, categories, genres, background
      // metacritic is an object with score and url
      // platforms is an object with windows, mac, and linux
      // categories and genres are arrays with objects with id and description
      
      
      if (doc[appID] == null) {
        //Logger.log("Steam API failed for appID " + appID)
        // Stop in case the service is down or we're rate limited
        userAlert(false)
        return
      }
      
      if (!doc[appID].success) {
        //Logger.log("Success = false for appID " + appID)
        // idk, some appIDs just don't work
        continue
      }
      
      var data = doc[appID].data
      
      var row = [data.type, data.name, data.detailed_description, data.about_the_game, data.header_image]
      if (data.metacritic) {
        row.push(data.metacritic.score)
      } else {
        row.push(null)
      }
      
      var platforms = []
      if (data.platforms.windows) {
        platforms.push("windows")
      }
      if (data.platforms.mac) {
        platforms.push("mac")
      }
      if (data.platforms.linux) {
        platforms.push("linux")
      }
      row.push(platforms.join(","))
      
      var categories = []
      if (data.categories) {
        for (k = 0; k < data.categories.length; k++) {
          categories.push(data.categories[k].description)
        }
        row.push(categories.join(","))
      } else {
        // 21979 doesn't have categories
        row.push(null)
      }
      
      var genres = []
      if (data.genres) {
        for (k = 0; k < data.genres.length; k++) {
          genres.push(data.genres[k].description)
        }
        row.push(genres.join(","))
      } else {
        // 71250 doesn't have genres
        row.push(null)
      }
      
      row.push(data.background)
      
      // Now edit the row by looping through cells
      for (k = 0; k < row.length; k++) {
        range.getCell(i, k + 2).setValue(row[k])
      }
      
      Logger.log("Updated appID " + appID)
    }
  }
  
  userAlert(false)
}