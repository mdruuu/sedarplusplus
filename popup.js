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


// What do I need to do on click? 
// Go to targetUrl.
// Check if we've arrived at targetUrl. If we did, continue. If not, load targetUrl.
// Sometimes, you're brought to https://www.sedarplus.ca/landingpage/
// Clear local storage.
// send message: 'search' and companyName
// send 'reset count'


function performSearch() {
  // clear statusPane
  let statusPane = document.getElementById('statusPane');
  statusPane.innerHTML = '';
  console.log('Search Request Received.')
  // clear chrome storage
  chrome.storage.local.clear(function() {
    console.log("Storage Cleared.")
  });
  console.log('Navigating to Sedar+.')
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    const targetUrl = 'https://www.sedarplus.ca/csa-party/service/create.html?targetAppCode=csa-party&service=searchReportingIssuers&_locale=en'
    const landingUrl = 'https://www.sedarplus.ca/landingpage/'

    chrome.tabs.update(tabId, { url: targetUrl }, function(tab) {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0].url === landingUrl) {
          console.log("Sedar+ Rerouted us. Reloading.");
          chrome.tabs.update(tabId, { url: targetUrl }, function(tab) {
            sendMessage(tabId);
          });
        } else {
          console.log("Correct site");
          sendMessage(tabId);
        }
      });
    });
  })};

function sendMessage(tabId) {
  console.log('Sending Message')
  const companyName = document.getElementById('companyName').value;    
  let selectedValues = $('#documentType').multiselect('getSelectedValues');
  chrome.storage.local.set({ searchRequested: true, companyName: companyName, selectedValues: selectedValues }); 
  chrome.tabs.sendMessage(tabId, { action: 'search', companyName: companyName});
  chrome.runtime.sendMessage({ action: 'reset_count' });
}