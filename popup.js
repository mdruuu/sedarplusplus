let defaultStatusPaneText
let modeButtonElement = document.getElementById('modeType');
let selectedModeButton // needs to be defined at performSearch, but need to be able to acces it in another function.
let filingTypeElement = document.getElementById('filingType')
let companyNameElement = document.getElementById('companyName')
let statusPaneElement = document.getElementById('statusPane')
let cutoffYearElement = document.getElementById('cutoffYear')
let modeButtons = document.querySelectorAll('.mode-button');

window.onload = function() {
  defaultStatusPaneText = document.getElementById('statusPane').innerHTML;
  modeButtons.forEach(button => {
    button.addEventListener('click', function() {
      modeButtons.forEach(btn => btn.classList.remove('selected'));
      this.classList.add('selected');
    });
    
  });
  filingTypeElement.addEventListener('change', function() {
    let allOption = this.options[0]; // assuming "All/Default" is the first option
    if (allOption.selected) {
        for (let i = 1; i < this.options.length; i++) {
            this.options[i].selected = false;
        }
    } else {
        allOption.selected = false;
    }
  });
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
    cutoffYearElement.value = result.cutoffYear || '';
    statusPaneElement.innerHTML = result.statusPane || defaultStatusPaneText
    let savedModeType = result.modeType || 'Regular';
    modeButtons.forEach(button => {
      if (button.value === savedModeType) {
        button.classList.add('selected');
      } else {
        button.classList.remove('selected');
      }
    })
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

  if (request.action === 'statusPane_tempChange') {
    let currentStatPane = statusPane.innerHTML
    statusPane.innerHTML = ''
    console.log("Fetching Doc. Please wait.")
    setTimeout(() => {
      statusPane.innerHTML = currentStatPane;
    }, 3000);    
  }
});


document.getElementById('searchBtn').addEventListener('click', performSearch);
function addEnterListener(elementId) {
  document.getElementById(elementId).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
          performSearch();
      }
      if (e.ctrlKey && e.shiftKey && e.key === "Backspace") {
        reset();
      }
  });
}
addEnterListener('companyName');
addEnterListener('cutoffYear');
addEnterListener('filingType');
addEnterListener('modeType');

document.getElementById('clearBtn').addEventListener('click', reset);
function reset() {
  // Reset form inputs to their default values
  companyNameElement.value = '';
  filingTypeElement.selectedIndex = 0;
  cutoffYearElement.value = '';
  statusPaneElement.innerHTML = defaultStatusPaneText;
  modeButtons.forEach(button => {
    if (button.value === 'Regular') {
      button.classList.add('selected');
    } else {
      button.classList.remove('selected');
    }
  })

  
  chrome.storage.local.clear()
  chrome.runtime.sendMessage({ action: 'reset_count' })
  companyNameElement.focus();
}

document.getElementById('reloadBtn').addEventListener('click', () => {
  chrome.runtime.reload();  
})

// document.getElementById('stopBtn').addEventListener('click', () => {
//   chrome.runtime.sendMessage( { action: "stop_running" })
//   chrome.storage.local.set({ searchRequested: false })
// })

document.addEventListener('click', function(e) {
  if (e.target.tagName === 'A' && e.target.hasAttribute('data-date')) {
    e.preventDefault();
    let date = e.target.getAttribute('data-date'); 
    let text = e.target.innerText;
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'grab_document', date: date, text: text });
    });
  }
});


function performSearch() {
  statusPaneElement.innerHTML = '';
  selectedModeButton = modeButtonElement.querySelector('.mode-button.selected')
  console.log(`Search Request Received. Mode ${selectedModeButton.value}`);
  chrome.storage.local.clear();
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0].url.includes('sedarplus')) {
      saveVariables(tabs[0].title);
      chrome.tabs.sendMessage(tabs[0].id, {action: 'search', page: tabs[0].title});
    } else {
      navigateToSedarPlus(tabs[0].id)
    }
  })
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'queryTab') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      let tabId = tabs[0].id;
      let title = request.title;
      let issuerProfileName = request.issuerProfileName;
      let lowerCaseIssuerProfileName = issuerProfileName.trim() !== '' ? issuerProfileName.toLowerCase() : '';
      
      let searchPageName = request.searchPageName;
      let lowerCaseSearchPageName = searchPageName.trim() !== '' ? searchPageName.toLowerCase() : '';
      
      let companyName = companyNameElement.value.toLowerCase();

      if (title === 'Reporting issuers list') {
        saveVariables(tabId, 'Reporting issuers list');
      } else if (title === "View Issuer Profile" && lowerCaseIssuerProfileName.includes(companyName)) {
        saveVariables(tabId, 'View Issuer Profile');
      } else if (title === 'Search' && lowerCaseSearchPageName.includes(companyName)) {
        saveVariables(tabId, 'Search');
      } else {
        navigateToSedarPlus(tabId);
      }
    });
  }

  if (request.action === 'need_restart') {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      navigateToSedarPlus(tabs[0].id)
    })
  }

});



function navigateToSedarPlus(tabId) {
  const targetUrl = 'https://www.sedarplus.ca/csa-party/service/create.html?targetAppCode=csa-party&service=searchReportingIssuers&_locale=en';
  const landingUrl = 'https://www.sedarplus.ca/landingpage/';

  console.log('Navigating to Sedar+.');
  chrome.tabs.update(tabId, { url: targetUrl }, async function(tab) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    saveVariables(tabId, 'Reporting issuers list');
    await new Promise(resolve => setTimeout(resolve, 3500));
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0].url === landingUrl) {
        console.log("Sedar+ Rerouted us. Reloading.");
        chrome.tabs.update(tabId, { url: targetUrl }, async function(tab) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          saveVariables(tabId, 'Reporting issuers list');
        });
      }
    });
  });
}
    

function saveVariables(tabId, pageMessage) {
  const fileTypeFilters = Array.from(filingTypeElement.selectedOptions).map(option => option.value);

  chrome.storage.local.set({ searchRequested: true, companyName: companyNameElement.value, fileTypeFilters: fileTypeFilters, modeType: selectedModeButton.value, cutoffYear: cutoffYearElement.value}); 
}

