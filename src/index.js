import axios from 'axios';

let errs = [];
let retry = [];
let completed = [];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function logErr(message) {
    errs.push(`${message}`);
}

function logRetry(entity) {
    retry.push(entity)
}

function logComplete(data) {
    completed.push(`Entity ${data} annotation completed.`);
}

function downloadLog(fileName, data) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data));
    element.setAttribute('download', fileName);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

function executeAnnotationScript(tab) {
    chrome.scripting.executeScript(
        {
            target: {tabId: tab.id},
            files: ['populate.js']
        });
}

async function createAnnotation({URL}) {
    return new Promise((resolve, reject) => {
        chrome.tabs.create({ url: URL, active: false}, async (tab) => {
            await sleep(3000);
            executeAnnotationScript(tab);
            setTimeout(() => resolve('Timeout'), 30000)
            chrome.runtime.onMessage.addListener((req, sender, sendRes) => {
                if(req.status === 'completed') {
                    console.log(`Completed in tab ${sender.tab.id}`);
                    sendRes({data: 'received'});
                    chrome.tabs.remove(sender.tab.id);
                    resolve('Completed');
                }
            }); 
        });
    });   
}

function setAnnotationDetails(form) {
    chrome.storage.local.set({
        'annotation': form['annotation'],
        'date': form['date'],
        'starred': form['starred'],
        'visibility': form['visibility']
    });
}

function downloadAllLogs() {
    downloadLog('errorsLog.txt', errs.join('\n'));
    downloadLog('retryLog.txt', retry.join('\n').replace(',', '\t'));
    downloadLog('completedLog.txt', completed.join('\n'));
}

function auth() {
    chrome.storage.local.clear();
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
}

function promptCaptchaResponse() {
    return new Promise((resolve, reject) => {
        setTimeout(() => resolve('no response'), 30000)
        let status  = confirm('Check captcha!');
        if(status) {
            resolve('retry');
        }
    })
}

async function handleResponse({count, entitiesRows, res}) {
    console.log(res);
                if (res === 'Timeout') {
                    console.log(`Automation ${count + 1}/${entitiesRows.length} failed.`);
                    let response = await promptCaptchaResponse();
                    if (response !== 'retry') {
                        logErr(`Entity ${entitiesRows[count]} annotation failed -- Timeout; Check Captcha or Entity does not exist.`);
                        logRetry(entitiesRows[count]);
                    } else {
                        return true;
                    }
                } else if(res === 'Completed') {
                    logComplete(entitiesRows[count]);
                    console.log(`Automation ${count + 1}/${entitiesRows.length} completed.`);
                } else {
                    logErr(`Entity ${entitiesRows[count]} annotation failed.`);
                    logRetry(entitiesRows[count]);
                    console.log(`Automation ${count + 1}/${entitiesRows.length} failed.`);
                }
                return false;
}

async function createAllAnnotations({URLs, entitiesRows}) {
    return new Promise(async (resolve, reject) => {
        let count = 0;
        let retryLimit = 3;
        for(let URL of URLs) {
            let res  = await createAnnotation({URL: URL});
            let retryEntity = await handleResponse({count: count, entitiesRows: entitiesRows, res: res});
            for(let i = 0; i < retryLimit; i++) {
                if(retryEntity !== true) {
                    break;
                }
                res = await createAnnotation({URL: URL});
                retryEntity = await handleResponse({count: count, entitiesRows: entitiesRows, res: res});
            }
            if (retryEntity === true) {
                await handleResponse({count: count, entitiesRows: entitiesRows, res: 'Failed'});
            }
            count++
        }
    resolve();
    })
}

async function genURL({accountId, propId, profId, token}) {
    let options = {
        params: {
            // key: apiKey
        },
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }
    let entity = await axios.get(`https://www.googleapis.com/analytics/v3/management/accounts/${accountId}/webproperties/${propId}`, options);
    let urlPartial = `a${accountId}w${entity.data.internalWebPropertyId}p${profId}`;
    var newURL = `https://analytics.google.com/analytics/web/#/${urlPartial}/admin/annotation/create`;
    return newURL;
}

function genEntitesRows(form) {
    let entitiesText = form['entities'];
    let entitiesRows = entitiesText.split('\n');
    entitiesRows = entitiesRows.map(e => e.split('\t'));
    return entitiesRows;
}

async function genAllURLs({form, token}) {
    let count = 0;
    let URLs = [];
    let entitiesRows = genEntitesRows(form);
    for(let row of entitiesRows) {
        let accountId = row[0];
        let propId = row[1];
        let profId = row[2];
        console.log(`Pulling entity ${count + 1}/${entitiesRows.length}.`);
        try {
            let newURL = await genURL({accountId: accountId, propId: propId, profId: profId, token: token});
            URLs.push(newURL);
        } catch(err) {
            logErr('Failed to get entity from API. Likely do not have access to this entity.' + row);
        }
        console.log('Entity pulled.');
        count++;
    }
    return {URLs: URLs, entitiesRows: entitiesRows};
}

function transformFormData(formData) {
    let obj = {};
    formData.forEach((val, key) => obj[key] = val);
    return obj;
}

function handleSubmit(form, event) {
    event.preventDefault();
    let formData = new FormData(form);
    formData = transformFormData(formData);
    setAnnotationDetails(formData);
    chrome.storage.local.get(['token'], async function(results) {
        toggleLoader();
        await createAllAnnotations(await genAllURLs({form: formData, token: results.token}));
        toggleLoader();
        downloadAllLogs();
        alert('Automation completed!');
        window.close();
    });
}

function toggleLoader(){
    let div = document.getElementsByClassName('container')[0];
    if (div.style.visibility == "hidden") {
        div.style.visibility = "visible";
    } else {
        div.style.visibility = "hidden";
    }
    
}

function main() {
    let form = document.getElementById('annotationForm');
    auth();
    form.addEventListener('submit', (e) => handleSubmit(form, e));
}

main();

