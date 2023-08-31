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
  console.log('Search Request Received.')
  console.log('Navigating to Sedar+.')
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    const targetUrl = 'https://www.sedarplus.ca/csa-party/service/create.html?targetAppCode=csa-party&service=searchReportingIssuers&_locale=en'
    const landingUrl = 'https://www.sedarplus.ca/landingpage/'

    chrome.tabs.update(tabId, { url: targetUrl });
    setTimeout(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0].url === landingUrl) {
          console.log("Sedar+ Rerouted us. Reloading.");
          chrome.tabs.update(tabId, { url: targetUrl });
        } else {
          console.log("Correct site");
        }
      });
    }, 500);
    
    chrome.storage.local.clear(function() {
      console.log('Storage Cleared')
      var error = chrome.runtime.lastError;
      if (error) {
        console.error(error);
      } else {
        // Set the searchRequested and companyName in local storage
        let selectedValues = $('#documentType').multiselect('getSelectedValues');
        chrome.storage.local.set({ searchRequested: true, companyName: companyName, selectedValues: selectedValues });
      };
    }); 
    console.log('Sending Message')
    chrome.tabs.sendMessage(tabId, { action: 'search', companyName});
    chrome.runtime.sendMessage({ action: 'reset_count' });
  });
}