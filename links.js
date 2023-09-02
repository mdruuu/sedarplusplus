chrome.storage.local.get('html', function(data) {
    if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        return;
    }
    const linksDiv = document.getElementById('links');
    for (let item of data.html) {
        let anchor = `<a href="${item.link}">${item.text}</a><br>Date: ${item.date}<br><br>`;
        linksDiv.innerHTML += anchor;
    }
    updateLinks();
});



// if (request.action === 'update_statusPane') {
//     let statusPane = document.getElementById('statusPane');
//     statusPane.innerHTML = ''
//     for (let item of request.data) {
//         console.log(item)
//         let anchor = `<a href="${item.link}">${item.text}</a><br>Date: ${item.date}<br><br>`;
//         statusPane.innerHTML += anchor;
//   }
//   updateLinks();
// };

function updateLinks() {
document.querySelectorAll('a').forEach(anchor => {
anchor.addEventListener('click', function(e) {
    e.preventDefault();
    chrome.tabs.create({ url: this.href });
});
});
}