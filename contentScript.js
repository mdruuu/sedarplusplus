
let oldLog = console.log;
console.log = function (message) {
    oldLog.apply(console, arguments);
    chrome.runtime.sendMessage({action: "log", message: message});
};


// let searchRequested, companyName, fileTypeFilters, modeType , fromDate, toDate, pFromDate, page, title


chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'refresh') {
        location.reload();        
    }
    // console.log(`Message received: ${JSON.stringify(request)}`);    
    else if (request.action === 'search') {
        let searchRequested, companyName, fileTypeFilters, modeType, fromDate, toDate, pFromDate, page
        page = request.page
        await new Promise(resolve => {
            chrome.storage.local.get(['searchRequested', 'companyName', 'fileTypeFilters', 'modeType', 'fromDate', 'toDate', 'pFromDate', 'pToDate'], function(result) {
                searchRequested = result.searchRequested
                companyName = result.companyName
                fileTypeFilters = result.fileTypeFilters
                modeType = result.modeType
                fromDate = result.fromDate
                toDate = result.toDate
                pFromDate = new Date(result.pFromDate)
                resolve();
            })
        })
        switch(page) {
            case 'Reporting issuers list':
                await findCompany(companyName);
                break;
            case 'View Issuer Profile':
                await clickDocLink(companyName);
                break;
            case 'Search':
                await searchPageProcess(companyName, fileTypeFilters, modeType, fromDate, toDate, pFromDate);
                break; 
            default:
                break;
        }
    } else if (request.action === 'grab_document') {
        grabDocument(request.date, request.text);
    }
})


async function findCompany(companyName) {
    const companyField = document.querySelector("#QueryString");
    console.log(`Searching for: ${companyName}`)
    companyField.value = companyName;
    await new Promise(resolve => setTimeout(resolve, 500)) // Processing doesn't show up when searching for company profile - I think. Have to use manual delay.
    const searchButton = document.querySelector(".searchButton.appIconSearch.keepInteractiveOnSubmit");
    searchButton.click();
    await new Promise(resolve => setTimeout(resolve, 1500)) // Processing doesn't show up when searching for company profile - I think. Have to use manual delay.
    const links = document.querySelectorAll(".searchReportingIssuers-results-page-entitiesRecord-entityNameBox-viewEntity.appMenu.appMenuItem.appMenuDepth0.viewInstanceUpdateStackPush.appReadOnly.appIndex0");
    if (links.length === 0) {
        console.log('No results round. Check name and try again.');
    } else if (links.length > 8) {
        console.log('Too many results. Likely due to page loading issue. Try again.');
    } else if (links.length === 1) {
        console.log('Company found. Clicking.');
        const firstLink = links[0];
        firstLink.click();
    } else if (links.length > 1) {
        console.log("Multiple links found: ")
        Array.from(links).forEach((link, index) => {
            const span = link.querySelector('.appReceiveFocus');
            if (span) {
                console.log(`${index + 1}. ${span.textContent}`);
            }
        });
        const matchingLink = Array.from(links).find(link => {
            const span = link.querySelector('.appReceiveFocus');
            return span && span.textContent.toLowerCase().includes(companyName.toLowerCase());
        });
        if (matchingLink) {
            const span = matchingLink.querySelector('.appReceiveFocus');
            console.log(`Closest company is: ${span.textContent}. If incorrect, try again with a more specific name.`)
            matchingLink.click();
        } else {
            console.log("Company not found in the results. Try again")
        }
    }

}

async function clickDocLink(companyName) {
    let profilePageElement = '.appPageTitleText'
    try {
        await checkRightPage(companyName, profilePageElement)
    } catch {
        return;
    }
    const docLinks = document.querySelectorAll(".viewSecuritiesIssuer-tabsBox-party-profileInfoBox-searchProfileDocumentsTab-documentsSearch.appMenu.appMenuItem.appMenuDepth0.noSave.noUrlStackPush.appReadOnly.appIndex0");
    const targetDocLink = Array.from(docLinks).find(el => el.textContent.includes('Search and download documents for this profile'));
    if (targetDocLink) {
    targetDocLink.click();
    console.log('Going to Document Search Page')
    }
}

async function searchPageProcess(companyName, fileTypeFilters, modeType, fromDate, toDate, pFromDate) {
    let searchPageElement = '.searchDocuments-tabs-criteriaAndButtons-criteria-criteriaBox-row1-multiDocSearch-multiPartyRepeaterWrapper-partynameFilterRepeater-filterDomain-entityNameNumberLookupBox-partyNameHeader'
    try {
        await checkRightPage(companyName, searchPageElement) // moved removeOption to inside checkRightPage function
    } catch {
        return;
    }

    let select = document.getElementById('FilingType');
    if (!fileTypeFilters.includes("All")) {
        await selectValues(fileTypeFilters, select);
    };
    const fromDateElement = document.querySelector('#DocumentDate')
    const toDateElement = document.querySelector('#DocumentDate2')

    if (fromDate !== '') {
        fromDateElement.value = fromDate;
        console.log(`Set From Date value to: ${fromDate}`)
    }    
    if (fromDate !== '' && toDate !== '') {
        toDateElement.value = toDate;
        console.log(`Set To Date value to: ${toDate}`)
    } else if (fromDate!== '' && toDate === '') {
        let todayDate = formatDate(new Date())
        toDateElement.value = todayDate
        console.log(`Set To Date value to: ${todayDate}`)
    }
    await new Promise(resolve => setTimeout(resolve, 500))
    const searchButton = document.querySelector(".appButton.searchDocuments-tabs-criteriaAndButtons-buttonPad2-search.appButtonPrimary.appSearchButton.appSubmitButton.appPrimaryButton.appNotReadOnly.appIndex1");
    if (searchButton) {
        searchButton.click();
    }
    await waitForElementToDisappear('catProcessing')

    let dateTitleElement = document.querySelector('.appTblCell.appTblCell3.appTblCellOdd.searchDocuments-tabs-criteriaAndButtons-results-page-csaFilingDocuments-SubmissionDateBox');
    let sort = dateTitleElement.getAttribute('aria-sort');
    // console.log(`TEST sort order: ${sort}`)
    if (sort === 'descending') {
        // do nothing
    } else if (sort === 'ascending') {
        console.log(`Ascending. Clicking clickSort once`)
        await clickSort(1);
    } else if (sort === 'none' ) {
        console.log(`Unordered list. Clicking clickSort twice.`)
        await clickSort(2);
    } 
    
    if (modeType !== "Regular") {
        // console.log(`TEST running processFileTypes`)
        await processFileTypes(modeType, fileTypeFilters, pFromDate);
    }
    chrome.storage.local.set({ searchRequested: false })
    console.log("Finished Processing")
}

async function clickSort(n) {
    for (i = 0; i < n; i++) {
        let dateTitleSelector = '.appTblCell.appTblCell3.appTblCellOdd.searchDocuments-tabs-criteriaAndButtons-results-page-csaFilingDocuments-SubmissionDateBox'
        let dateTitleElement = document.querySelector(dateTitleSelector);
        let oldSort = dateTitleElement.getAttribute('aria-sort');
        let  xpath = "//a[.//span[contains(text(), 'Submitted date')]]";
        let matchingElement = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        console.log(`Sorting List. Clicking...${i + 1}`)
        matchingElement.click();
        await new Promise(resolve => {setTimeout(resolve, 750)}) // Slowing down
        await new Promise(resolve => {
            const intervalId = setInterval(() => {
                let dateTitleElement = document.querySelector(dateTitleSelector);
                let newSort = dateTitleElement.getAttribute('aria-sort');
                if (newSort !== oldSort) {
                    clearInterval(intervalId);
                    resolve();
                }
            }, 100)
        })
    }
}

async function grabDocument(date, text) {
    chrome.runtime.sendMessage({ action: 'statusPane_tempChange'})
    await removeOption(false);
    let searchButton = document.querySelector(".appButton.searchDocuments-tabs-criteriaAndButtons-buttonPad2-search.appButtonPrimary.appSearchButton.appSubmitButton.appPrimaryButton.appNotReadOnly.appIndex1");

    // Convert date from "15 Aug 2022" format to "DD/MM/YYYY" format
    let parts = date.split(' ');
    let months = {Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'};
    let slashDate = parts[0] + '/' + months[parts[1]] + '/' + parts[2];

    //? For whatever dumbass reason, I gotta re-identify this date element each time I set the date. otherwise, dates won't enter in properly. 
    let fromDateElement = document.querySelector('#DocumentDate')
    let toDateElement = document.querySelector('#DocumentDate2')

    fromDateElement.value = slashDate;
    toDateElement.value = slashDate;
    searchButton.click();
    await waitForElementToDisappear('catProcessing')
    await new Promise(resolve => setTimeout(resolve, 500)) // slowing down - otherwise, the error loop below sometimes doesn't run properly. 

    let errorElement = document.querySelector(".appSearchNoResults")
    if (errorElement) {
        console.log("Sedar date filter error. Attempting a workaround.")
        let errorText = errorElement.textContent
        if (errorText.includes('no search results')) {
            let fromDate = prevNextDay(slashDate, 'prev')
            let toDate = prevNextDay(slashDate, 'next')
            let fromDateElement = document.querySelector('#DocumentDate')
            let toDateElement = document.querySelector('#DocumentDate2')        
            fromDateElement.value = fromDate;
            toDateElement.value = toDate;
            searchButton.click();
            await waitForElementToDisappear('catProcessing')
        }
    }

    // Look for the element and click on the link where span == text
    let links = document.querySelectorAll('.appDocumentView.appResourceLink.appDocumentLink');
    for (let link of links) {
        let row = link.closest('.appTblRow');
        let dateElement = row.querySelector('.appAttrDateTime .appAttrValue span[aria-hidden="true"]');
        let dateText = dateElement.textContent
        let truncDate = dateText.substring(0,11)
        
        let span = link.querySelector('span');
        if (span && span.textContent === text && truncDate === date) {
            link.click();
            break;
        }
    }
    chrome.runtime.sendMessage({action: 'statusPane_original'})
}

async function processFileTypes(modeType, fileType, pFromDate) {
    let combinedAllData = []
    for (let i = 0; i < fileType.length; i++) {
        if (modeType === "Download") {
            await downloadDocSimple(pFromDate);
        } 
        else if (modeType === "Link") {
            let allData = await grabLinks(1);
            combinedAllData.push(...allData);
        }
        else if (modeType === 'DownloadAll' || modeType === 'LinkAll') {
            let allData = await processMultiPages(modeType, pFromDate);
            combinedAllData.push(...allData);
        }
        if (i < fileType.length - 1) {
            await removeOption(true);
        }
    }
    if (modeType === 'Link' || modeType === 'LinkAll') {
        chrome.runtime.sendMessage({action: 'update_statusPane', data: JSON.stringify(combinedAllData), pFromDate: pFromDate});
    }
}

async function downloadDocSimple(pFromDate) {
    let linkElements = document.querySelectorAll('.appTblCell2 a.appDocumentView.appResourceLink.appDocumentLink');
    let clickNextPage = 'No'
    for (let linkElement of linkElements) {
        let linkName = linkElement.querySelector('span').textContent;
        let row = linkElement.closest('.appTblRow');
        let dateElement = row.querySelector('.appAttrDateTime .appAttrValue span[aria-hidden="true"]');
        let rowDate = new Date(dateElement.textContent);
        let shortRowDate = rowDate.toString().substring(0,11)
        // let rowYear = date.getFullYear();
        // let cutoffYear = fromDate.getFullYear();
        if (rowDate >= pFromDate) {
            console.log(`Downloading: ${linkName} Date: ${shortRowDate}`)
            linkElement.click();
            clickNextPage = 'Yes'
        } else {
            clickNextPage = 'No'
            break
        }
        let delay = Math.floor(Math.random() * 750);
        await new Promise(resolve => setTimeout(resolve, 750 + delay));
    }
    return clickNextPage
}


async function processMultiPages(mode, pFromDate) {
    let dateId = '.appAttrDateTime .appAttrValue span[aria-hidden="true"]'
    let rowElement = document.querySelector('.appTblRow.appTblRow0');
    let newDate;
    let oldDate = rowElement.querySelector(dateId).textContent; 

    let pageLinks = document.querySelectorAll('a[id^="head-pagination-item-"]:not([aria-label="Next Page"])');
    let maxPage = Math.max(...Array.from(pageLinks).map(link => parseInt(link.textContent)));
    if (pageLinks.length === 0) {
         maxPage = 1;
    }
    let allData = [];

    for (let page = 1; page <= maxPage; page++) {
        let result = (mode === 'DownloadAll') ? await downloadDocSimple(pFromDate) : await grabLinks(page, pFromDate);
        let data = result.data;
        if (mode === 'LinkAll') allData.push(...data);
        
        if (page < maxPage) {
            let clickNextPage = result.clickNextPage;
            if (clickNextPage === 'No') break;
            let nextPageLink = document.querySelector('a[aria-label="Next Page"]');        
            if (nextPageLink) nextPageLink.click();
            await new Promise(resolve => {
                const intervalId = setInterval(() => {
                    let rowElement = document.querySelector('.appTblRow.appTblRow0');
                        newDate = rowElement.querySelector(dateId).textContent;
                    if (newDate !== oldDate) {
                        clearInterval(intervalId);
                        resolve();
                    }
                }, 100);
            });
            oldDate = newDate;
        }   
    }
    return allData 
}

async function grabLinks(page, pFromDate) {
    let data = [];
    let rows = Array.from(document.querySelectorAll('.appTblRow')); 
    let clickNextPage = 'No'
    for (let row of rows.slice(1)) {
        let linkElement = row.querySelector('.appTblCell2 a.appDocumentView.appResourceLink.appDocumentLink');
        let dateElement = row.querySelector('.appAttrDateTime .appAttrValue span[aria-hidden="true"]');
        let rowDate = new Date(dateElement.textContent);
        if (rowDate >= pFromDate) {
            let link = linkElement.href;
            let text = linkElement.textContent;
            let date = dateElement.textContent;
            data.push({text: text, link: link, date: date.substring(0, 11), page: page})
            clickNextPage = 'Yes'
        } else {
            console.log(`Date reached. Doc: ${rowDate}, Cutoff: ${pFromDate}`)
            clickNextPage = 'No'
            break
        }
    };
    return {data: data, clickNextPage: clickNextPage};
}

async function removeOption(singleMode) {
    let removeButtons = document.querySelectorAll(".select2-selection__choice__remove")
    
    if (removeButtons.length === 0) {
        return;
    } else {
        let n = singleMode ? 1 : removeButtons.length;
        for (i = 0; i < n; i++ ) {
            let removeButtons = document.querySelectorAll(".select2-selection__choice__remove") // have to double it otherwise button click doesn't work reliably.
            let button = removeButtons[0]
            button.click()
            await waitForElementToDisappear('catProcessing')
            // await new Promise(resolve => setTimeout(resolve, 750)) // gotta slow down the loop to wait for site response.
        }
    }
    const searchButton = document.querySelector(".appButton.searchDocuments-tabs-criteriaAndButtons-buttonPad2-search.appButtonPrimary.appSearchButton.appSubmitButton.appPrimaryButton.appNotReadOnly.appIndex1");
    if (searchButton) {
        searchButton.click();
    }
    await waitForElementToDisappear('catProcessing') 
}

async function selectValues(values, select) {
    console.log(`Filtering for: ${values}`);
    for(let i = 0; i < select.options.length; i++) {
        if(values.includes(select.options[i].value)) {
            select.options[i].selected = true;
            console.log(`Selected: ${select.options[i].value}`)
        }
    }
    let event = new Event('change');
    select.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 1000)) // change event happens in background. Have to use manual timeout. 
    const searchButton = document.querySelector(".appButton.searchDocuments-tabs-criteriaAndButtons-buttonPad2-search.appButtonPrimary.appSearchButton.appSubmitButton.appPrimaryButton.appNotReadOnly.appIndex1");
    if (searchButton) {
        searchButton.click();
        await waitForElementToDisappear('catProcessing');
    }
}

function waitForElementToDisappear(elementId) {
    return new Promise(resolve => {
        // First, wait for the element to appear
        const waitForAppearIntervalId = setInterval(() => {
            const element = document.getElementById(elementId);
            if (element) {
                // Once the element has appeared, clear this interval
                clearInterval(waitForAppearIntervalId);

                // Then, wait for the element to disappear
                const waitForDisappearIntervalId = setInterval(() => {
                    const element = document.getElementById(elementId);
                    if (!element) {
                        // Once the element has disappeared, clear this interval and resolve the promise
                        clearInterval(waitForDisappearIntervalId);
                        resolve();
                    }
                }, 100); // Check every 100ms
            }
        }, 100); // Check every 100ms
    });
}


async function checkRightPage(companyName, elementId) {
    return new Promise(async (resolve, reject) => {
        let element = document.querySelector(elementId)
        let name = element ? element.textContent.toLowerCase() : "Not Found"
        if (name.includes(companyName.toLowerCase())) {
            await removeOption(false);
            resolve();
        } else {
            chrome.runtime.sendMessage({action: 'need_restart'});
            reject();
        }
    })
}


function formatDate(date) {
  let day = String(date.getDate()).padStart(2, '0');
  let month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  let year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function prevNextDay(date, mode) {
    let parts = date.split('/');
    let day = parseInt(parts[0]);
    let month = parseInt(parts[1]);
    let year = parseInt(parts[2]);
    let n 
    if (mode === 'prev') { n = -1} else if (mode === 'next') { n = 1 } else {console.log("Incorrect prevNextDay mode.")}

    // Create a new Date object with the given date
    let dateObj = new Date(year, month -1, day);

    // Subtract one day from the date
    dateObj.setDate(dateObj.getDate() + n);

    // Format the new date in DD/MM/YYYY format
    let newDay = String(dateObj.getDate()).padStart(2, '0');
    let newMonth = String(dateObj.getMonth() + 1).padStart(2, '0'); // Months are 0-based
    let newYear = dateObj.getFullYear();

    let newDate = `${newDay}/${newMonth}/${newYear}`;
    return newDate;
}



// async function downloadLinksOriginal(companyName) {
//     let linkName = linkElement.querySelector('span').textContent;
//     linkName = linkName.replace('.pdf', '');        
//     let row = linkElement.closest('.appTblRow');
//     let dateElement = row.querySelector('.appAttrDateTime .appAttrValue span[aria-hidden="true"]').textContent;
//     dateElement = dateElement.substring(0, 9);
//     let downloadInfo = {
//         url: linkElement.href,
//         filename: `sedarplusplus/${companyName}/${companyName}_${linkName}_${dateElement}.pdf`,
//         conflictAction: 'uniquify',
//     };
//     // Send a message to the background script to perform the download
//     chrome.runtime.sendMessage({action: "download", downloadInfo: downloadInfo});
// } //! This is the original function that downloaded the file into a specific folder and renamed it. However, you can only do it on one page before it starts rerouting your traffic to a bot checker, and it becomes impossible to run this code again. USE RESULT.COMPANYNAME to pass companyname, not REQUEST.
