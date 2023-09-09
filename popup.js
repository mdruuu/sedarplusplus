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
  let statusPane = document.getElementById('statusPane');
    if (request.action === 'log') {
      statusPane.innerHTML += '<span>' + request.message + '</span><br>';
    }

    if (request.action === 'update_sidePane') {
      // statusPane.innerHTML = '' DISABLING IT FOR TESTING.
      let allData = JSON.parse(request.data)
      allData.sort((a, b) => new Date(b.date) - new Date(a.date));
      let cutoffYear = document.getElementById('cutoffYear').value;
      allData = allData.filter(data => new Date(data.date).getFullYear() > cutoffYear);
      statusPane.innerHTML = `<table><tr><th>Page</th><th>Title</th><th>Date</th></tr>${allData.map(data => `<tr><td>${data.page}</td><td><a href="#" data-date="${data.date}">${data.text}</a></td><td>${data.date}</td></tr>`).join('')}</table>`;
    }
});


document.getElementById('searchBtn').addEventListener('click', performSearch);

document.getElementById('companyName').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        performSearch();
    }
});

document.addEventListener('click', function(e) {
  if (e.target.tagName === 'A' && e.target.hasAttribute('data-date')) {
    e.preventDefault();
    let date = e.target.getAttribute('data-date'); 
    let text = e.target.innerText;
    console.log(text)
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'grab_document', date: date, text: text });
    });
  }
});


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
      await new Promise(resolve => setTimeout(resolve, 3500));
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
  const modeType = document.getElementById('modeType').value;
  const cutoffYear = document.getElementById('cutoffYear').value;

  chrome.storage.local.set({ searchRequested: true, companyName: companyName, fileTypeFilters: fileTypeFilters, modeType: modeType, cutoffYear: cutoffYear }, function() {
    chrome.tabs.sendMessage(tabId, { action: 'search', companyName: companyName});
    chrome.runtime.sendMessage({ action: 'reset_count' });
  }); 
}

