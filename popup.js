let defaultStatusPaneText
let modeTypeElement = document.getElementById('modeType');
let filingTypeElement = document.getElementById('filingType')
let companyNameElement = document.getElementById('companyName')
let statusPaneElement = document.getElementById('statusPane')
let cutoffYearElement = document.getElementById('cutoffYear')

window.onload = function() {
  defaultStatusPaneText = document.getElementById('statusPane').innerHTML;
  chrome.storage.local.set({ searchRequested: false })
  chrome.storage.local.get(['companyName', 'fileTypeFilters', 'modeType', 'cutoffYear', 'statusPane'], function(result) {
    companyNameElement.value = result.companyName || ''
    let fileTypeFilters = result.fileTypeFilters || [];
    if (fileTypeFilters.length === 0) {
      filingTypeElement.selectedIndex = 0;
    } else {
      Array.from(filingTypeElement.options).forEach(option => {
        option.selected = fileTypeFilters.includes(option.value);
      });
    }
    modeTypeElement.selectedIndex = result.modeType ? Array.from(modeTypeElement.options).findIndex(option => option.value === result.modeType) : 0;
    cutoffYearElement.value = result.cutoffYear || '';
    statusPaneElement.innerHTML = result.statusPane || defaultStatusPaneText
  })

  document.getElementById('companyName').focus();
};

function logtoPane(message) {
  statusPaneElement.innerHTML += '<span>' + message + '</span><br>';
  chrome.storage.local.set({ statusPane: statusPaneElement.innerHTML });
}


let oldLog = console.log;
console.log = function (message) {
    oldLog.apply(console, arguments);
    logtoPane(message);
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'log') {
    logtoPane(request.message)
  }

  if (request.action === 'update_statusPane') {
    // statusPane.innerHTML = '' DISABLING IT FOR TESTING.
    let allData = JSON.parse(request.data)
    allData.sort((a, b) => new Date(b.date) - new Date(a.date));
    let cutoffYearValue = cutoffYearElement.value;
    allData = allData.filter(data => new Date(data.date).getFullYear() >= cutoffYearValue);
    statusPaneElement.innerHTML = `<table><tr><th>Page</th><th>Title</th><th>Date</th></tr>${allData.map(data => `<tr><td>${data.page}</td><td><a href="#" data-date="${data.date}">${data.text}</a></td><td>${data.date}</td></tr>`).join('')}</table>`;
    chrome.storage.local.set({ statusPane: statusPaneElement.innerHTML })
    }
});


document.getElementById('searchBtn').addEventListener('click', performSearch);
function addEnterListener(elementId) {
  document.getElementById(elementId).addEventListener('keypress', function (e) {
      if (e.key === 'Enter') {
          performSearch();
      }
  });
}
addEnterListener('companyName');
addEnterListener('cutoffYear');

document.getElementById('clearBtn').addEventListener('click', reset);
function reset() {
  // Reset form inputs to their default values
  companyNameElement.value = '';
  filingTypeElement.selectedIndex = 0;
  modeTypeElement.selectedIndex = 0;
  cutoffYearElement.value = '';
  statusPaneElement.innerHTML = defaultStatusPaneText;
  
  chrome.storage.local.clear()
  chrome.runtime.sendMessage({ action: 'reset_count' })
  companyNameElement.focus();
}

document.getElementById('reloadBtn').addEventListener('click', () => {
  chrome.runtime.reload();  
})

document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage( { action: "stop_running" })
})



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


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'queryTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      let tabId = tabs[0].id;
      const title = request.title;
      const issuerProfileName = request.issuerProfileName.toLowerCase();
      const searchPageName = request.searchPageName.toLowerCase();
      const companyName = companyNameElement.value.toLowerCase();

      if (title === 'Reporting issuers list') {
        sendMessage(tabId, 'issuerSearchPage');
      } else if (title === "View Isser Profile" && issuerProfileName.includes(companyName)) {
        sendMessage(tabId, 'profilePage');
      } else if (title === 'Search' && searchPageName.includes(companyName)) {
        sendMessage(tabId, 'docSearchPage');
      } else {
        navigateToSedarPlus(tabId);
      }
    });
  }
});

function performSearch() {
  statusPaneElement.innerHTML = '';
  console.log('Search Request Received.');
  chrome.storage.local.clear();
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    let tabId = tabs[0].id
    chrome.tabs.sendMessage(tabId, {action: 'preload'});
    console.log("Request Sent")
  })
}

function navigateToSedarPlus(tabId) {
  const targetUrl = 'https://www.sedarplus.ca/csa-party/service/create.html?targetAppCode=csa-party&service=searchReportingIssuers&_locale=en';
  const landingUrl = 'https://www.sedarplus.ca/landingpage/';

  console.log('Navigating to Sedar+.');
  chrome.tabs.update(tabId, { url: targetUrl }, async function(tab) {
    sendMessage(tabId, 'issuerSearchPage');
    await new Promise(resolve => setTimeout(resolve, 3500));
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0].url === landingUrl) {
        console.log("Sedar+ Rerouted us. Reloading.");
        chrome.tabs.update(tabId, { url: targetUrl }, function(tab) {
          sendMessage(tabId, 'issuerSearchPage');
        });
      }
    });
  });
}






    

function sendMessage(tabId, pageMessage) {
  const fileTypeFilters = Array.from(filingTypeElement.selectedOptions).map(option => option.value);

  chrome.storage.local.set({ searchRequested: true, companyName: companyNameElement.value, fileTypeFilters: fileTypeFilters, modeType: modeTypeElement.value, cutoffYear: cutoffYearElement.value }, function() {
    chrome.tabs.sendMessage(tabId, { action: 'search', companyName: companyNameElement, page: pageMessage});
    chrome.runtime.sendMessage({ action: 'reset_count' });
  }); 
}

