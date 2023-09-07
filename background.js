let pageLoadedCount = 0;

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active && tab.url.includes('sedarplus')) {
        console.log('Sending Page Loaded Message')
        chrome.tabs.sendMessage(tabId, { action: `page_loaded${pageLoadedCount}` });
        pageLoadedCount++;
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'reset_count') {
        pageLoadedCount = 0;
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'download') {
        (async function() {
            await new Promise(resolve => setTimeout(resolve, 500));
            chrome.downloads.download(request.downloadInfo);
            // console.log(`Download Replacement ${JSON.stringify(request.downloadInfo, null, 2)}`);        
            // console.log(`Download Call Time ${new Date()}`) 
        })();
        
    }
});
