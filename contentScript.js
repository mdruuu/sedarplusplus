
let oldLog = console.log;
console.log = function (message) {
    oldLog.apply(console, arguments);
    chrome.runtime.sendMessage({action: "log", message: message});
};

let isRunning = true;

// let selectValueMap = {
//     "Financials": ['ANNUAL_FINANCIAL_STATEMENTS', 'INTERIM_FINANCIAL_STATEMENTSREPORT'],
//     "MD&A": ['ANNUAL_MDA', 'INTERIM_MDA'],
//     "ARAIF": ["ANNUAL_REPORT", "ANNUAL_INFORMATION_FORMS"], 
//     "News_Release": ["NEWS_RELEASES", "MATERIAL_CHANGE_REPORT"],
//     "Prospectus": ["LONG_FORM_PROSPECTUS", "LISTING_APPLICATION", "SHORT_FORM_PROSPECTUS_NI_44101", "SHELF_PROSPECTUS_NI_44102",],
//     "USER1": ["USER1"]
// }

let searchRequested
let companyName
let fileTypeFilters
let modeType 
let cutoffYear
let page
let title



chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    // console.log(`Message received: ${JSON.stringify(request)}`);    
    if (request.action === 'stop_running') {
        isRunning = false;
    }
    if (request.action === 'preload') {
        const title = document.title
        const issuerProfileElement = document.querySelector('.appPageTitleText');
        const issuerProfileName = issuerProfileElement ? issuerProfileElement.textContent : '';

        const searchPageElement = document.querySelector('.appAttrValue');
        const searchPageName = searchPageElement ? searchPageElement.textContent : '';
        chrome.runtime.sendMessage({action: 'queryTab', title: title, issuerProfileName: issuerProfileName, searchPageName: searchPageName})
    } else if (request.action === 'search') {
        page = request.page
        console.log(page)
        await new Promise(resolve => {
            chrome.storage.local.get(['searchRequested', 'companyName', 'fileTypeFilters', 'modeType', 'cutoffYear'], function(result) {
                searchRequested = result.searchRequested
                companyName = result.companyName
                fileTypeFilters = result.fileTypeFilters
                modeType = result.modeType
                cutoffYear = result.cutoffYear
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
                await searchPageProcess(companyName, fileTypeFilters, modeType, cutoffYear);
                break; 
            default:
                console.log('Unknown page');
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
    await new Promise(resolve => setTimeout(resolve, 1000)) // Processing doesn't show up when searching for company profile - I think. Have to use manual delay.
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
    console.log('Clicking Doc Link')
    }
}

async function searchPageProcess(companyName, fileTypeFilters, modeType, cutoffYear) {
    let searchPageElement = '.searchDocuments-tabs-criteriaAndButtons-criteria-criteriaBox-row1-multiDocSearch-multiPartyRepeaterWrapper-partynameFilterRepeater-filterDomain-entityNameNumberLookupBox-partyNameHeader'
    try {
        await checkRightPage(companyName, searchPageElement)
        await removeOption(false);
    } catch {
        return;
    }

    await new Promise(resolve => setTimeout(resolve, 500)) // Need to slow down between 2nd click and calling additional functions.
    
    let select = document.getElementById('FilingType');
    if (!fileTypeFilters.includes("All")) {
        await selectValues(fileTypeFilters, select);
    };
    let sort = await dateClassify()
    if (sort === 'descending') {
        
    } else if (sort === 'ascending') {
        await clickSort(1);
    } else if (sort === 'unordered' ) {
        await clickSort(2);
    } 
    if (modeType !== "Regular") {
        await processFileTypes(modeType, fileTypeFilters, cutoffYear);
    }
    
    chrome.storage.local.set({ searchRequested: false })
    console.log("Finished Processing")
}

async function dateClassify() {
    let numTime = [];
    let diffList = [];
    let dateElements = '.appAttrDateTime .appAttrValue span[aria-hidden="true"]';
    let elements = document.querySelectorAll(dateElements);
    for (let i = 0; i < elements.length; i++) {
        let date = elements[i]
        let datetext = date ? date.textContent : 'NA'
        let dateParts = datetext.split(' ');
        let year = dateParts[2];
        let month = new Date(dateParts[1] + ' 1, 2012').getMonth();
        let day = dateParts[0];
        let dateobj = new Date(year, month, day);
        let num = dateobj.getTime();
        numTime.push(num);
    }

    for (let i = 0; i < numTime.length - 1; i++) {
    let diff = numTime[i] - numTime[i+1]
    diffList.push(diff)
    }

    let allPositive = diffList.every(num => num >= 0);
    let allNegative = diffList.every(num => num <= 0);

    if (allPositive) {
        return 'descending'
    } else if (allNegative) {
        return 'ascending'
    } else {
        return 'unordered'
    }
}

async function clickSort(n) {
    for (i = 0; i < n; i++) {
        let  xpath = "//a[.//span[contains(text(), 'Submitted date')]]";
        let matchingElement = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        let oldDate = document.querySelector('.appAttrDateTime .appAttrValue span[aria-hidden="true"]').textContent;
        console.log(`Sorting List. CLicking...${i + 1}`)
        matchingElement.click();
        await new Promise(resolve => {
            const intervalId = setInterval(() => {
                let newDate = document.querySelector('.appAttrDateTime .appAttrValue span[aria-hidden="true"]').textContent;
                if (newDate !== oldDate) {
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
    let startDate = document.querySelector('#DocumentDate')
    let endDate = document.querySelector('#DocumentDate2')
    let searchButton = document.querySelector(".appButton.searchDocuments-tabs-criteriaAndButtons-buttonPad2-search.appButtonPrimary.appSearchButton.appSubmitButton.appPrimaryButton.appNotReadOnly.appIndex1");

    // Convert date from "15 Aug 2022" format to "DD/MM/YYYY" format
    let parts = date.split(' ');
    let months = {Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'};
    date = parts[0] + '/' + months[parts[1]] + '/' + parts[2];

    startDate.value = date;
    endDate.value = date;
    console.log("Searching for Specific Date")
    searchButton.click();
    await waitForElementToDisappear('catProcessing')
    // Look for the element and click on the link where span == text
    let links = document.querySelectorAll('.appDocumentView.appResourceLink.appDocumentLink');
    for (let link of links) {
        let span = link.querySelector('span');
        if (span && span.textContent === text) {
            console.log('Found link. Clicking')
            link.click();
            break;
        }
    }
}


async function processFileTypes(modeType, fileType, cutoffYear) {
    let combinedAllData = []
    for (let i = 0; i < fileType.length; i++) {
        if (modeType === "Download") {
            await downloadDocSimple();
        } 
        else if (modeType === "Link") {
            let allData = await grabLinks(1);
            combinedAllData.push(...allData);
        }
        else if (modeType === 'DownloadAll' || modeType === 'LinkAll') {
            let allData = await processMultiPages(modeType, cutoffYear);
            combinedAllData.push(...allData);
        }
        if (i < fileType.length - 1) {
            console.log("Running removeOption")
            await removeOption(true);
        }
    }
    if (modeType === 'Link' || modeType === 'LinkAll') {
        console.log(modeType)
        chrome.runtime.sendMessage({action: 'update_statusPane', data: JSON.stringify(combinedAllData)});
    }
}

async function downloadDocSimple(cutoffYear) {
    let linkElements = document.querySelectorAll('.appTblCell2 a.appDocumentView.appResourceLink.appDocumentLink');
    let clickNextPage = 'No'
    for (let linkElement of linkElements) {
        let linkName = linkElement.querySelector('span').textContent;
        let row = linkElement.closest('.appTblRow');
        let rowNum = row.className;
        let dateElement = row.querySelector('.appAttrDateTime .appAttrValue span[aria-hidden="true"]');
        let date = new Date(dateElement.textContent);
        let rowYear = date.getFullYear();
        if (rowYear >= cutoffYear) {
            console.log(`Downloading: ${rowNum} Date: ${date}`)
            // linkElement.click();
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


async function processMultiPages(mode, cutoffYear) {
    let dateId = '.appAttrDateTime .appAttrValue span[aria-hidden="true"]'
    let rowElement = document.querySelector('.appTblRow.appTblRow0');
    let newDate;
    let oldDate = rowElement.querySelector(dateId).textContent; 

    let pageLinks = document.querySelectorAll('a[id^="head-pagination-item-"]:not([aria-label="Next Page"])');
    let maxPage = Math.max(...Array.from(pageLinks).map(link => parseInt(link.textContent)));
    console.log(pageLinks)
     if (pageLinks.length === 0) {
         maxPage = 1;
     }
    let allData = [];

    for (let page = 1; page <= maxPage; page++) {
        let result = (mode === 'DownloadAll') ? await downloadDocSimple(cutoffYear) : await grabLinks(page, cutoffYear);
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

async function grabLinks(page, cutoffYear) {
    let data = [];
    let rows = Array.from(document.querySelectorAll('.appTblRow')); 
    let clickNextPage = 'No'
    for (let row of rows.slice(1)) {
        let linkElement = row.querySelector('.appTblCell2 a.appDocumentView.appResourceLink.appDocumentLink');
        let dateElement = row.querySelector('.appAttrDateTime .appAttrValue span[aria-hidden="true"]');
        let date = new Date(dateElement.textContent);
        let rowYear = date.getFullYear();

        if (rowYear >= cutoffYear) {
            let link = linkElement.href;
            let text = linkElement.textContent;
            let date = dateElement.textContent;
            data.push({text: text, link: link, date: date.substring(0, 11), page: page})
            clickNextPage = 'Yes'
        } else {
            console.log(`Does not match: ${rowYear}, ${cutoffYear}`)
            clickNextPage = 'No'
            break
        }
    };
    return {data: data, clickNextPage: clickNextPage};
}

async function removeOption(singleMode) {
    let removeButtons = document.querySelectorAll(
        ".select2-selection__choice__remove"
    )
    
    if (removeButtons.length === 0) {
        return;
    } else {
        let n = singleMode ? 1 : removeButtons.length;
        for (i = 0; i < n; i++ ) {
            let button = removeButtons[i]
            button.click()
            await waitForElementToDisappear('catProcessing')
        }
    }
    const searchButton = document.querySelector(".appButton.searchDocuments-tabs-criteriaAndButtons-buttonPad2-search.appButtonPrimary.appSearchButton.appSubmitButton.appPrimaryButton.appNotReadOnly.appIndex1");
    if (searchButton) {
        searchButton.click();
        console.log('Filter Search Button Clicked.');
    }
    await waitForElementToDisappear('catProcessing') // switched from waiting for 4 seconds
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
    console.log('Dispatched change event');
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
    return new Promise((resolve, reject) => {
        let element = document.querySelector(elementId)
        let name = element ? element.textContent.toLowerCase() : "Not Found"
        if (name.includes(companyName.toLowerCase())) {
            resolve();
        } else {
            chrome.runtime.sendMessage({action: 'need_restart'});
            reject();
        }
    })
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
