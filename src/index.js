import axios from 'axios';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

function logErr(message) {
    chrome.storage.local.get(['errLog'], result => {
        if(result.errLog) {
            chrome.storage.local.set({'errLog': `${message}\n`});
        }
        else {
            chrome.storage.local.set({'errLog': `${message}\n`});
        }
    });
}

function logComplete(data) {
    chrome.storage.local.get(['completedLog'], result => {
        if(result.completedLog) {
            chrome.storage.local.set({'completedLog': `${result.completedLog}Entity ${data} annotation completed.\n`});
        }
        else {
            chrome.storage.local.set({'completedLog': `Entity ${data} annotation completed.\n`});
        }
    });
}

function downloadLog(fn, data) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data));
    element.setAttribute('download', fn);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

async function chromeExecution(newURL, data) {
    return new Promise((resolve, reject) => {
        chrome.tabs.create({ url: newURL, active: false}, async (tab) => {
            await sleep(3000);
            chrome.scripting.executeScript(
                {
                    target: {tabId: tab.id},
                    files: ['populate.js']
                });
            chrome.runtime.onMessage.addListener((req, sender, sendRes) => {
                if(req.status === 'completed') {
                    console.log(`Completed in tab ${sender.tab.id}`);
                    sendRes({data: 'received'});
                    chrome.tabs.remove(sender.tab.id);
                    logComplete(data);
                    resolve('Completed');
                }
            });        
        });
    });   
}

let submitButton = document.getElementById('submit');

chrome.storage.local.get(['token'], async function(result) {
    let token = result.token;
    if (token) {
        chrome.identity.removeCachedAuthToken({token: token}, () => {
            console.log('Token cleared.');
        })
    }
    chrome.identity.getAuthToken({interactive: true}, function(token) {
        console.log('got the token', token);
        chrome.storage.local.set({'token': token});
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

    let URLs = [];

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

        let count = 0;
        for(let row of entitiesRows) {
            console.log(`Pulling entity ${count + 1}/${entitiesRows.length}.`);
            try {
                let entity = await axios.get(`https://www.googleapis.com/analytics/v3/management/accounts/${row[0]}/webproperties/${row[1]}`, options);
                let urlPartial = `a${row[0]}w${entity.data.internalWebPropertyId}p${row[2]}`;
                var newURL = `https://analytics.google.com/analytics/web/#/${urlPartial}/admin/annotation/create`;
                URLs.push(newURL);
            } catch(err) {
                logErr('Failed to get entity from API. Likely do not have access to this entity.');
            }
            console.log('Entity pulled.');
            count++;
        }
        
        count = 0;
        for(let URL of URLs) {
            await chromeExecution(URL, entitiesRows[count]).then(res => {
                console.log(res);
                if (!res) {
                    logErr(`Entity ${data} annotation failed.`);
                }
            });
            console.log(`Automation ${count + 1}/${URLs.length} completed.`);
            count++;
        }
        
        chrome.storage.local.get(['errLog'], result => {
            downloadLog('errLog.txt', result.errLog);
        });

        chrome.storage.local.get(['completedLog'], result => {
            downloadLog('completedLog.txt', result.completedLog);
        });

        alert('Automation completed!');
        window.close();
    }); 
});

