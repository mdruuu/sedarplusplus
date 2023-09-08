
let oldLog = console.log;
console.log = function (message) {
    oldLog.apply(console, arguments);
    chrome.runtime.sendMessage({action: "log", message: message});
};


// let selectValueMap = {
//     "Financials": ['ANNUAL_FINANCIAL_STATEMENTS', 'INTERIM_FINANCIAL_STATEMENTSREPORT'],
//     "MD&A": ['ANNUAL_MDA', 'INTERIM_MDA'],
//     "ARAIF": ["ANNUAL_REPORT", "ANNUAL_INFORMATION_FORMS"], 
//     "News_Release": ["NEWS_RELEASES", "MATERIAL_CHANGE_REPORT"],
//     "Prospectus": ["LONG_FORM_PROSPECTUS", "LISTING_APPLICATION", "SHORT_FORM_PROSPECTUS_NI_44101", "SHELF_PROSPECTUS_NI_44102",],
//     "USER1": ["USER1"]
// }


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // The !== search is here because the code runs on page_loaded messages. So this code block is listening for bunch of page_loaded message. THere is probably a much better / easier way to do this. Come back to it after implementing link mode. 
    if (request.action !== 'search') {
        chrome.storage.local.get(['searchRequested', 'companyName', 'fileTypeFilters', 'modeType'], function(result) {
            if (result.searchRequested) {
                switch (request.action) {
                    case 'page_loaded0':
                        console.log('Reporting Issuers Page Loaded.')
                        console.log('Attempting Search.')
                        const companyField = document.querySelector("#QueryString");
                        if (companyField) {
                            console.log('Search Field Found.');
                            console.log(`Searching for: ${result.companyName}`)
                            companyField.value = result.companyName;
                            setTimeout(() => { const searchButton = document.querySelector(".searchButton.appIconSearch.keepInteractiveOnSubmit");
                            if (searchButton) {
                                searchButton.click();
                                console.log('Search Button Clicked.');
                            }}, 750);
                            setTimeout(() => {
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
                                        return span && span.textContent.toLowerCase().includes(result.companyName.toLowerCase());
                                    });
                                    if (matchingLink) {
                                        const span = matchingLink.querySelector('.appReceiveFocus');
                                        console.log(`Closest company is: ${span.textContent}. If incorrect, try again with a more specific name.`)
                                        matchingLink.click();
                                    } else {
                                        console.log("Company not found in the results. Try again")
                                    }
                                } 
                                }, 2000);
                            }
                        break;
                    case 'page_loaded1': 
                        console.log('Company Page Loaded');
                        const docLinks = document.querySelectorAll(".viewSecuritiesIssuer-tabsBox-party-profileInfoBox-searchProfileDocumentsTab-documentsSearch.appMenu.appMenuItem.appMenuDepth0.noSave.noUrlStackPush.appReadOnly.appIndex0");
                        const targetDocLink = Array.from(docLinks).find(el => el.textContent.includes('Search and download documents for this profile'));
                        if (targetDocLink) {
                        targetDocLink.click();
                        console.log('Clicking Doc Link')
                        }
                        break;
                    case 'page_loaded2':
                        console.log('Company Documents Page Loaded');

                        // first, do 2 clicks on sort, to sort by descending order.
                        let clickCount = 0;
                        const intervalId = setInterval(() => {
                            const xpath = "//a[.//span[contains(text(), 'Submitted date')]]";
                            const matchingElement = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                            if (matchingElement) {
                                console.log(`Sorting List. Need 2 Clicks. Clicking...${++clickCount}`);
                                matchingElement.click();
                                if (clickCount === 2) {
                                    clearInterval(intervalId);
                                    
                                    
                                    setTimeout(async () => {
                                        const actionFunctionMap = {
                                            'Download': downloadLinksSimple,
                                            'DownloadAll': processAllLinks('DownloadAll'),
                                            'Link': grabLinks,
                                            'LinkAll': processAllLinks('LinkAll')
                                        };

                                        let select = document.getElementById('FilingType');
                                        if (!result.fileTypeFilters.includes("All")) {
                                            await selectValues(result.fileTypeFilters, select);
                                        };
                                        if (result.modetype !== "Regular") {
                                            await processFileTypes(result.modeType, result.fileTypeFilters, actionFunctionMap[result.modeType]);
                                        }
                                    }, 2000);
                                }
                            }                        
                        }, 2000)
                        break;
                    default: {
                        console.log('Unknown action:', request.action);
                        }
                };
            };
        });
    };
    if (request.action === 'grab_document') {
        grabDocument(request.date, request.text);
    }
});

async function grabDocument(date, text) {
    await removeOption();
    let startDate = document.querySelector('#DocumentDate')
    let endDate = document.querySelector('#DocumentDate2')
    let searchButton = document.querySelector(".appButton.searchDocuments-tabs-criteriaAndButtons-buttonPad2-search.appButtonPrimary.appSearchButton.appSubmitButton.appPrimaryButton.appNotReadOnly.appIndex1");

    // Convert date from "15 Aug 2022" format to "DD/MM/YYYY" format
    let parts = date.split(' ');
    let months = {Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'};
    date = parts[0] + '/' + months[parts[1]] + '/' + parts[2];

    startDate.value = date;
    endDate.value = date;
    searchButton.click();
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


async function processFileTypes(modeType, fileType, actionFunction) {
    for (let i = 0; i < fileType.length; i++) {
        await actionFunction();
        if (i < fileType.length - 1) {
            await removeOption();
        }
    }
    console.log("Finished processing.")
}

async function downloadLinksSimple() {
    let linkElements = document.querySelectorAll('.appTblCell2 a.appDocumentView.appResourceLink.appDocumentLink');
    for (let linkElement of linkElements) {
        let linkName = linkElement.querySelector('span').textContent;
        let rowElement = linkElement.closest('.appTblRow');
        let rowNum = rowElement.className;
        let dateElement = rowElement.querySelector('.appAttrDateTime .appAttrValue span[aria-hidden="true"]').textContent;
        // dateElement = dateElement.substring(0, 9);
        console.log(`Downloading: ${rowNum} Date: ${dateElement}`)

        // linkElement.click();
        let delay = Math.floor(Math.random() * 750);
        await new Promise(resolve => setTimeout(resolve, 750 + delay));
    }
}

async function downloadLinksOriginal(companyName) {
    let linkName = linkElement.querySelector('span').textContent;
    linkName = linkName.replace('.pdf', '');        
    let row = linkElement.closest('.appTblRow');
    let dateElement = row.querySelector('.appAttrDateTime .appAttrValue span[aria-hidden="true"]').textContent;
    dateElement = dateElement.substring(0, 9);
    let downloadInfo = {
        url: linkElement.href,
        filename: `sedarplusplus/${companyName}/${companyName}_${linkName}_${dateElement}.pdf`,
        conflictAction: 'uniquify',
    };
    // Send a message to the background script to perform the download
    chrome.runtime.sendMessage({action: "download", downloadInfo: downloadInfo});
} //! This is the original function that downloaded the file into a specific folder and renamed it. However, you can only do it on one page before it starts rerouting your traffic to a bot checker, and it becomes impossible to run this code again. USE RESULT.COMPANYNAME to pass companyname, not REQUEST.


function processAllLinks(mode) {
    return async function() {
        let dateId = '.appAttrDateTime .appAttrValue span[aria-hidden="true"]'
        let rowElement = document.querySelector('.appTblRow.appTblRow0');
        let newDate;
        let oldDate = rowElement.querySelector(dateId).textContent;

        let pageLinks = document.querySelectorAll('a[id^="head-pagination-item-"]:not([aria-label="Next Page"], [aria-label="Page 1"])');
        let allData = [];
        let page = 1

        let data = (mode === 'DownloadAll') ? await downloadLinksSimple() : await grabLinks(page);
            if (mode === 'LinkAll') allData.push(...data);
        for (let pageLink of pageLinks) {   
            console.log("Going to Next Page")
            pageLink.click();
            await new Promise(resolve => {
                const intervalId = setInterval(() => {
                    let rowElement = document.querySelector('.appTblRow.appTblRow0');
                     newDate = rowElement.querySelector(dateId).textContent;
                    if (newDate !== oldDate) {
                        clearInterval(intervalId);
                        resolve();
                    }
                }, 100); // Check every 100ms
            });
            page += 1
            oldDate = newDate;
            let data = (mode === 'DownloadAll') ? await downloadLinksSimple() : await grabLinks(page);
                if (mode === 'LinkAll') allData.push(...data);
        }
        if (mode === 'LinkAll') {
            chrome.runtime.sendMessage({action: 'update_sidePane', data: JSON.stringify(allData)});
        }
    }
}

async function grabLinks(page) {
    let data = [];
    let rows = document.querySelectorAll('.appTblRow'); 
    for (let row of rows) {
        let linkElement = row.querySelector('.appTblCell2 a.appDocumentView.appResourceLink.appDocumentLink');
        let dateElement = row.querySelector('.appAttrDateTime .appAttrValue span[aria-hidden="true"]');

        if (linkElement && dateElement) {
            let link = linkElement.href;
            let text = linkElement.textContent;
            let date = dateElement.textContent;
            data.push({text: text, link: link, date: date.substring(0, 11), page: page})
        };
    };
    return data;
};



function updateLinksPage(combinedLinks) {
    console.log("Sending update_links")
    // console.log(combinedLinks)
    chrome.runtime.sendMessage({action: "update_links", data: combinedLinks});
}



async function removeOption() {
    let removeButton = document.querySelector(
        ".select2-selection__choice__remove"
    )
    if (removeButton) {
        removeButton.click();
    } else {
        console.log("No remove button")
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    const searchButton = document.querySelector(".appButton.searchDocuments-tabs-criteriaAndButtons-buttonPad2-search.appButtonPrimary.appSearchButton.appSubmitButton.appPrimaryButton.appNotReadOnly.appIndex1");
    if (searchButton) {
        searchButton.click();
        console.log('Filter Search Button Clicked.');
    }
    await new Promise(resolve => setTimeout(resolve, 4000));

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
    await new Promise(resolve => setTimeout(resolve, 2000));
    const searchButton = document.querySelector(".appButton.searchDocuments-tabs-criteriaAndButtons-buttonPad2-search.appButtonPrimary.appSearchButton.appSubmitButton.appPrimaryButton.appNotReadOnly.appIndex1");
    if (searchButton) {
        searchButton.click();
        console.log('Search Button Clicked.');
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
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


