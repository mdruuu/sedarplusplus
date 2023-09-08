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

    // if (request.action === 'update_links') {
    //     chrome.storage.local.set({ html: request.data }, function() {
    //       chrome.tabs.create({ url: chrome.runtime.getURL("links.html") });
    //     });
    // }
});


document.getElementById('searchBtn').addEventListener('click', performSearch);

document.getElementById('companyName').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        performSearch();
    }
});

document.getElementById('resetBtn').addEventListener('click', resetEverything);

function resetEverything() {
  // Reset the state of the popup
  document.getElementById('companyName').value = '';
  document.getElementById('documentType').selectedIndex = 0;
  document.getElementById('mode-type').selectedIndex = 0;
  document.getElementById('statusPane').innerHTML = '';

  // Clear chrome storage
  chrome.storage.local.clear(function() {
      console.log("Storage Cleared.")
  });

}



function performSearch() {
  document.getElementById('statusPane').innerHTML = '';
  console.log('Search Request Received.')
  chrome.storage.local.clear(function() {
    console.log("Storage Cleared.")
  });
  console.log('Navigating to Sedar+.')
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabId = tabs[0].id;
    const targetUrl = 'https://www.sedarplus.ca/csa-party/service/create.html?targetAppCode=csa-party&service=searchReportingIssuers&_locale=en'
    const landingUrl = 'https://www.sedarplus.ca/landingpage/'

    chrome.tabs.update(tabId, { url: targetUrl }, async function(tab) {
      sendMessage(tabId);
      await new Promise(resolve => setTimeout(resolve, 3000));
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0].url === landingUrl) {
          console.log("Sedar+ Rerouted us. Reloading.");
          chrome.tabs.update(tabId, { url: targetUrl }, function(tab) {
          sendMessage(tabId);
          });
        }
      }); 
    });
  })};

function sendMessage(tabId) {
  const companyName = document.getElementById('companyName').value;    
  const fileTypeElement = document.getElementById('filingType');
  const fileTypeFilters = Array.from(fileTypeElement.selectedOptions).map(option => option.value);
  const modeType = document.getElementById('mode-type').value;

  chrome.storage.local.set({ searchRequested: true, companyName: companyName, fileTypeFilters: fileTypeFilters, modeType: modeType }, function() {
    chrome.tabs.sendMessage(tabId, { action: 'search', companyName: companyName});
    chrome.runtime.sendMessage({ action: 'reset_count' });
    // console.log('Message Sent');
  }); 
}

