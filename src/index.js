import axios from 'axios';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

async function chromeExecution(newURL) {
    return new Promise((resolve, reject) => {
        chrome.tabs.create({ url: newURL, active: false}, async (tab) => {
            await sleep(3000);
            chrome.scripting.executeScript(
                {
                    target: {tabId: tab.id},
                    files: ['populate.js']
                });
            await sleep(3000);
            chrome.tabs.remove(tab.id);
            resolve();
        });
    });   
}

let submitButton = document.getElementById('submit');

chrome.storage.local.get(['token'], async function(result) {
    let token = result.token;
    chrome.identity.removeCachedAuthToken({token: token}, () => {
        console.log('Token cleared.');
        chrome.identity.getAuthToken({interactive: true}, function(token) {
            console.log('got the token', token);
            chrome.storage.local.set({'token': token});
        })
    })
});

submitButton.addEventListener('click', async () => {
    let entitiesText = document.getElementById('entities').value;
    let annotationText = document.getElementById('annotation').value;
    let date = document.getElementById('date').value;
    let starred = document.getElementById('starred').checked;
    let visibility = document.getElementById('shared').value;
    let entitiesRows = entitiesText.split('\n');
    entitiesRows = entitiesRows.map(e => e.split('\t'));

    let entities = [];

    chrome.storage.local.set({
        'annotation': annotationText,
        'date': date,
        'starred': starred,
        'visibility': visibility
    });

    chrome.storage.local.get(['token'], async function(result) {
        let token = result.token;
        let options = {
            params: {
                // key: apiKey
            },
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }

        for(let row of entitiesRows) {
            let entity = await axios.get(`https://www.googleapis.com/analytics/v3/management/accounts/${row[0]}/webproperties/${row[1]}`, options);
            entities.push(entity.data);
            
        }

        for(let entity of entities) {
            let urlPartial = `a${entity.accountId}w${entity.internalWebPropertyId}p${entity.defaultProfileId}`;
            var newURL = `https://analytics.google.com/analytics/web/#/${urlPartial}/admin/annotation/create`;
            await chromeExecution(newURL);
        }
    }); 
});

