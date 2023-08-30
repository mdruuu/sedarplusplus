window.onload = function() {
  document.getElementById('companyName').focus();
  $('#documentType').multiselect({
    includeSelectAllOption: true,
    enableClickableOptGroups: true
  });
};


let oldLog = console.log;
console.log = function (message) {
    oldLog.apply(console, arguments);
    let statusPane = document.getElementById('statusPane');
    if (statusPane) {
        statusPane.innerHTML += '<span>' + message + '</span><br>';
    }
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'log') {
        let statusPane = document.getElementById('statusPane');
        if (statusPane) {
            statusPane.innerHTML += '<span>' + request.message + '</span><br>';
        }
    }
});

document.getElementById('searchBtn').addEventListener('click', performSearch);

document.getElementById('companyName').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        performSearch();
    }
});


function performSearch() {
  let statusPane = document.getElementById('statusPane');
  if (statusPane) {
    statusPane.innerHTML = '';
  }

  const companyName = document.getElementById('companyName').value;
  console.log('Search Request: ', companyName)
  console.log('Navigating to Sedar+.')
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    chrome.tabs.update(tabId, { url: 'https://www.sedarplus.ca/csa-party/service/create.html?targetAppCode=csa-party&service=searchReportingIssuers&_locale=en' })
    chrome.tabs.sendMessage(tabId, { action: 'search', companyName });
    chrome.runtime.sendMessage({ action: 'reset_count' });
    
    // Clear the local storage
    chrome.storage.local.clear(function() {
      var error = chrome.runtime.lastError;
      if (error) {
        console.error(error);
      } else {
        // Set the searchRequested and companyName in local storage
        chrome.storage.local.set({ searchRequested: true, companyName: companyName });
        };
      });
    
    // Open a new tab with the specified URL
  });
}
