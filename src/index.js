import axios from 'axios';

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
        let apiKey = 'AIzaSyCCrt6Nw2gP6wGXSrteMlJN-cE3ZUzCcDY';
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
            // let entity = await axios.get(`https://www.googleapis.com/analytics/v3/management/accounts/66031361/webproperties/UA-66031361-19`, options);
            entities.push(entity.data);
            
        }

        for(let entity of entities) {
            let urlPartial = `a${entity.accountId}w${entity.internalWebPropertyId}p${entity.defaultProfileId}`;
            var newURL = `https://analytics.google.com/analytics/web/#/${urlPartial}/admin/annotation/create`;
            chrome.tabs.create({ url: newURL, active: false}, (tab) => {
                chrome.tabs.onUpdated.addListener((tabId, info) => {
                    chrome.scripting.executeScript(
                        {
                            target: {tabId: tabId},
                            files: ['populate.js']
                        },
                        () => {}
                    )
                })
            });
        }
    }); 
});

