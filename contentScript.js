
let oldLog = console.log;
console.log = function (message) {
    oldLog.apply(console, arguments);
    chrome.runtime.sendMessage({action: "log", message: message});
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== 'search') {
        chrome.storage.local.get(['searchRequested', 'companyName'], function(result) {
            if (result.searchRequested) {
                switch (request.action) {
                    case 'page_loaded0':
                        console.log('Reporting Issuers Page Loaded.')
                        console.log('Attempting Search.')
                        const companyField = document.querySelector("#QueryString");
                        if (companyField) {
                            console.log('Search Field Found.');
                            console.log(`Searching for ${result.companyName}`)
                            companyField.value = result.companyName;
                            setTimeout(() => { const searchButton = document.querySelector(".searchButton.appIconSearch.keepInteractiveOnSubmit");
                            if (searchButton) {
                                searchButton.click();
                                console.log('Search Button Clicked.');
                            }}, 500);
                            setTimeout(() => {
                                const links = document.querySelectorAll(".searchReportingIssuers-results-page-entitiesRecord-entityNameBox-viewEntity.appMenu.appMenuItem.appMenuDepth0.viewInstanceUpdateStackPush.appReadOnly.appIndex0");
                                console.log('Clicking on the First Company Link');
                                console.log(Array.from(links).map(link => link.outerHTML));
                                if (links.length > 0) {
                                    const firstLink = links[0];                                 
                                    firstLink.click();
                                } else {
                                    console.log('No Results Found');
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
                        let clickCount = 0;
                        const intervalId = setInterval(() => {
                            const xpath = "//a[.//span[contains(text(), 'Submitted date')]]";
                            const matchingElement = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                            if (matchingElement) {
                                matchingElement.click();
                                console.log(`Sorting List. Need 2 Clicks. #${++clickCount}`);
                                if (clickCount >= 2) {
                                    clearInterval(intervalId);
                                }
                            } else {
                                console.log('No element with "Submitted date" found');
                                clearInterval(intervalId);
                            }
                        }, 2000);
                        break;
                    default: {
                        console.log('Unknown action:', request.action);
                        }
                }
            }})}})

