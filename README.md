# Steam Games Spreadsheet
## Google Apps Script

To coordinate playing games with multiple friends with very different Steam libraries, I created this Apps Script in Google Sheets. It pulls down using [Steam's XML API](http://steamcommunity.com/id/t3hub3rk1tten/games?xml=1) the public list of games for my friends, and puts the data into a tab for each friend. Then it uses the [Steam Storefront JSON API](https://wiki.teamfortress.com/wiki/User:RJackson/StorefrontAPI) to get the names, categories, and other metadata for each game. Finally a few Sheets functions combine all these sheets together into one sheet, with conditional formatting and filtering.

This is a Google Apps Script. More info on Apps Script: https://developers.google.com/apps-script/

## Instructions
1. Create a spreadsheet with sheets: Filter, Log, and then one sheet for each Steam username
2. Run updateAllUserSheets() and then updateStoreData() to test
3. Set triggers if desired. I have updateStoreData running once a day, and updateUserSheets every 2 hours (it updates one sheet at a time and cycles through)