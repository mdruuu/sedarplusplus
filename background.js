let oldLog = console.log;
console.log = function (message) {
    oldLog.apply(console, arguments);
    chrome.runtime.sendMessage({action: "log", message: message});
};


chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (changeInfo.status === 'complete' && tab.active && tab.url.includes('sedarplus')) {
        console.log('onUpdated Triggered')
        let result = await chrome.storage.local.get(['searchRequested'])
         if  (result.searchRequested) {
            chrome.tabs.sendMessage(tabId, { action: 'search', page: tab.title })
        } 
    }
});





// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (request.action === 'check_page') {
//         let title

//         let intervalId = setInterval(function() {
//             chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
//                 if (tabs) { title = tabs[0].title }
//             })
//             if (title.length > 2 && title.length < 20 && title !== request.title) {
//                 clearInterval(intervalId);
//                 console.log(title)
//                 sendResponse(title)
//                 console.log("response sent")
//             }
//         }, 100);
//     }            
// });

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (request.action === 'download') {
//         (async function() {
//             await new Promise(resolve => setTimeout(resolve, 500));
//             chrome.downloads.download(request.downloadInfo);
//             // console.log(`Download Replacement ${JSON.stringify(request.downloadInfo, null, 2)}`);        
//             // console.log(`Download Call Time ${new Date()}`) 
//         })();
        
//     }
// });
