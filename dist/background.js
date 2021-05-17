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