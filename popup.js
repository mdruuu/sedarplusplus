// Printing console logs to statusPane
let oldLog = console.log;
console.log = function (message) {
    oldLog.apply(console, arguments);
    logtoPane(message);
};

function logtoPane(message) {
  statusPaneElement.innerHTML += '<span>' + message + '</span><br>';
  chrome.storage.local.set({ statusPane: statusPaneElement.innerHTML });
}

// Defining some global variables to be accessed in multiple places. 
let defaultStatusPaneText, fromDate, toDate, pFromDate, pToDate, selectedModeButton
const filingTypeElement = document.getElementById('filingType')
const companyNameElement = document.getElementById('companyName')
const statusPaneElement = document.getElementById('statusPane')
const dateElement = document.getElementById('dateString')
const modeButtonElement = document.getElementById('modeType');
const modeButtons = document.querySelectorAll('.mode-button');


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
    dateElement.value = result.dateString || '';
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

// SHORTCUTS AAND KEYDOWN LISTENERS 
function addKeydownListener(elementId) {
  document.getElementById(elementId).addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      performSearch();
    }
    if (e.ctrlKey && e.shiftKey && e.key === "Backspace") {
      reset();
    }
  });
}
document.getElementById('searchBtn').addEventListener('click', performSearch);
addKeydownListener('companyName');
addKeydownListener('dateString');
addKeydownListener('filingType');
addKeydownListener('modeType');

document.getElementById('clearBtn').addEventListener('click', reset);

document.getElementById('reloadBtn').addEventListener('click', () => {
  chrome.runtime.reload();  
})

// EVENT LISTENERS 
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'log') {
    logtoPane(request.message)
  }

  // For Linkgrabber mode, display the results in statusPane as an HTML table
  if (request.action === 'update_statusPane') {
    // statusPane.innerHTML = '' DISABLING IT FOR TESTING.
    let allData = JSON.parse(request.data)
    allData.sort((a, b) => new Date(b.date) - new Date(a.date));
    allData = allData.filter(data => new Date(data.date) >= new Date(pFromDate));
    statusPaneElement.innerHTML = `<table><tr><th>Page</th><th>Title</th><th>Date</th></tr>${allData.map(data => `<tr><td>${data.page}</td><td><a href="#" data-date="${data.date}">${data.text}</a></td><td>${data.date}</td></tr>`).join('')}</table>`;
    chrome.storage.local.set({ statusPane: statusPaneElement.innerHTML })
  }

  // On clicking link to download the file, temporarily blanks out the statusPane and logs some interim messages - so people know what's happening. 
  if (request.action === 'statusPane_tempChange') {
    let currentStatPane = statusPane.innerHTML
    statusPane.innerHTML = ''
    console.log("Fetching Doc. Please wait.")
    setTimeout(() => {
      statusPane.innerHTML = currentStatPane;
    }, 3000);    
  }

  if (request.action === 'need_restart') {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      navigateToSedarPlus(tabs[0].id, fromDate, toDate, pFromDate, pToDate)
    })
  }

});

// Code for calling grab_document function in cs.js when the html table is clicked on
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


//FUNCTIONS 
function performSearch() {
  statusPaneElement.innerHTML = '';
  selectedModeButton = modeButtonElement.querySelector('.mode-button.selected')
  if (selectedModeButton.value !== "Regular" && !dateElement.value.trim()) {
    console.log("Specify Date. Hit Reset to see instruction.")
    return;
  }
  let dateString = dateElement.value
  let parsedDate = parseDates(dateString)
  let fromDate = parsedDate.fromDate
  let toDate = parsedDate.toDate
  pFromDate = processDate(fromDate)
  pToDate = processDate(toDate)
  
  console.log(`Search Request Received.`);
  chrome.storage.local.clear();
  
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0].url.includes('sedarplus')) {
      saveVariables(tabs[0].title, fromDate, toDate, pFromDate, pToDate);
      chrome.tabs.sendMessage(tabs[0].id, {action: 'refresh', page: tabs[0].title});
    } else {
      navigateToSedarPlus(tabs[0].id, fromDate, toDate, pFromDate, pToDate)
    }
  })
}

function reset() {
  // Reset form inputs to their default values
  companyNameElement.value = '';
  filingTypeElement.selectedIndex = 0;
  dateElement.value = '';
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


function navigateToSedarPlus(tabId, fromDate, toDate, pFromDate, pToDate) {
  const targetUrl = 'https://www.sedarplus.ca/csa-party/service/create.html?targetAppCode=csa-party&service=searchReportingIssuers&_locale=en';
  const landingUrl = 'https://www.sedarplus.ca/landingpage/';

  console.log('Navigating to Sedar+.');
  chrome.tabs.update(tabId, { url: targetUrl }, async function(tab) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    saveVariables(tabId, fromDate, toDate, pFromDate, pToDate);
    await new Promise(resolve => setTimeout(resolve, 3500));
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0].url === landingUrl) {
        console.log("Sedar Rerouted us. Reloading.");
        chrome.tabs.update(tabId, { url: targetUrl }, async function(tab) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          saveVariables(tabId, fromDate, toDate, pFromDate, pToDate);
        });
      }
    });
  });
}
    

function saveVariables(tabId, fromDate, toDate, pFromDate, pToDate) {
  console.log(`saveVaraibles ${pFromDate}`)
  const fileTypeFilters = Array.from(filingTypeElement.selectedOptions).map(option => option.value);

  chrome.storage.local.set({ searchRequested: true, companyName: companyNameElement.value, fileTypeFilters: fileTypeFilters, modeType: selectedModeButton.value, dateString: dateElement.value, fromDate: fromDate, toDate: toDate, pFromDate: pFromDate.toString(), pToDate: pToDate}); 
}


//Date parsing functions below. Unit tests complete. 
function parseDates(input) {
  let fromDate, toDate;
  let today = new Date();
  if (input.includes('L')) {
    let value = parseInt(input.substring(1, input.length - 1));
    toDate = new Date();
    switch (input[input.length-1]) {
      case 'D':
        fromDate = new Date(today.setDate(today.getDate() - value));
        break;
      case 'W':
        fromDate = new Date(today.setDate(today.getDate() - value * 7));
        break;
      case 'M':
        fromDate = new Date(today.setMonth(today.getMonth() - value));
        break;
      case 'Q':
        fromDate = new Date(today.setMonth(today.getMonth() - value * 3));
        break;
      case 'Y':
        fromDate = new Date(today.setFullYear(today.getFullYear() - value))
        break;
    }
  } else {
    let dates = input.split(' ');
    fromDate = parseDate(dates[0]);
    if (dates.length > 1) {
      toDate = parseDate(dates[1]);
    }
  }

  return {
    fromDate: formatDate(fromDate),
    toDate: toDate ? formatDate(toDate) : ''
  };
}

function parseDate(dateString) {
  if (dateString.length === 4) {
    return new Date(dateString, 0, 1);
  } else if (dateString.length === 6) {
    return new Date(dateString.substring(0, 4), dateString.substring(4) - 1, 1);
  } else {
    return new Date(dateString.substring(0, 4), dateString.substring(4, 6) - 1, dateString.substring(6));
  }
}

function formatDate(date) {
  let day = String(date.getDate()).padStart(2, '0');
  let month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  let year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function processDate(date) {
  let [day, month, year] = date.split('/')
  return pDate = new Date(year, month-1, day);
}