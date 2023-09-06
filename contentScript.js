
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
    if (request.action !== 'search') {
        chrome.storage.local.get(['searchRequested', 'companyName', 'selectedValues'], function(result) {
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
                                console.log('Clicking on the First Company Link');
                                console.log(Array.from(links).map(link => link.outerHTML));
                                if (links.length > 5) {
                                    console.log('Too many results. Likely due to page loading issue. Try again.');
                                } else if (links.length > 0) {
                                    const firstLink = links[0];                                 
                                    firstLink.click();
                                } else {
                                    console.log('No Results Found. Check name and try again.');
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
                                        let select = document.getElementById('FilingType');
                                        if (result.selectedValues !== "All") {
                                            let combinedLinks = [];
                                            await selectValues(result.selectedValues, select);
                                            combinedLinks.push(...grabLinks());
                                            for(let i = 1; i < result.selectedValues.length; i++) {
                                                await removeOption();
                                                combinedLinks.push(...grabLinks());
                                            }
                                            updateLinksPage(combinedLinks);
                                        };
                                    }, 2000);                                    
                                }
                            }
                        
                        }, 2000)
  
                        break;
                    default: {
                        console.log('Unknown action:', request.action);
                        }
                }
            }})}})


function grabLinks() {
    let data = [];
    let rows = document.querySelectorAll('.appTblRow'); 
    for (let row of rows) {
        let linkElement = row.querySelector('.appTblCell2 a.appDocumentView.appResourceLink.appDocumentLink');
        let dateElement = row.querySelector('.appAttrDateTime .appAttrValue span[aria-hidden="true"]');

        if (linkElement && dateElement) {
            let link = linkElement.href;
            let text = linkElement.textContent;
            let date = dateElement.textContent;
            data.push({text: text, link: link, date: date})
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

    // Need to select the right remove button
    // Matching  by name is going to be a little tricky because the identifier is not the same as the descriptor that shows up. May have to use the mapping I have above. 
    // Can I just find the first matching element and remove that? 
    // Oh - querySelector alraedy selects first element. 

    let removeButton = document.querySelector(
        ".select2-selection__choice__remove"
    )
    if (removeButton) {
        removeButton.click();
    } else {
        console.log("Can't find remove  button")
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    const searchButton = document.querySelector(".appButton.searchDocuments-tabs-criteriaAndButtons-buttonPad2-search.appButtonPrimary.appSearchButton.appSubmitButton.appPrimaryButton.appNotReadOnly.appIndex1");
    if (searchButton) {
        searchButton.click();
        console.log('Search Button Clicked.');
    }
    await new Promise(resolve => setTimeout(resolve, 5000));

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
    await new Promise(resolve => setTimeout(resolve, 5000));
}





