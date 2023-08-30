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