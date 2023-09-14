# sedarplusplus
Sedar+ sucks. This chrome extension makes it suck a little less.

### Installation 

To use it, click on <> Code -> Local -> Download ZIP. 
Unzip it into a folder. 
Go to Chrome / Edge, and go to extensions page, then turn on developer mode.
Click on load unpacked and select the folder. 

### Use Case

The extension has three modes. 
1. Doc Page
2. Link Grabber
3. Doc Downloader

#### Company Doc Page

Enter the company name, choose the filing type you want to filter, and hit search. The extension will bring you to to the company's document page, with documents sorted in reverse chronological order. 

Company Doc Page mode only works with single filing type filter. If used with multiple filters, only the last filter will show up. This is due to a bug in Sedar page and there's nothing I can do about it.

#### Link Grabber 

Sedar by default only shows you 10 links per page. Link Grabber mode will go through the pages, grab the links, and sort them by date. Clicking on the document will start the download for that document. 

Link Grabber works with multiple filing type filters (Hold Ctrl). If you specify Annual Financials and Interim Financials, it will cycle through both filing types and present you with a combined list. 


#### Doc Downloader 

Sometimes, you want to download all the annual and interim MD&A for a specific company. Doc Downloader mode will do this. 

Similar to Link Grabber, use with multiple filing types 

Note: Sedar's filter functionality is busted. Multiple filingtype filters do not work. Documents pre 2015 do not show up in filtered. As a result, Link Grabber and Doc Downloader will only show files that are from 2015 or newer. 