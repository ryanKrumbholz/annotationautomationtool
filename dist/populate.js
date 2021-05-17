function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

function formatDate(date) {
    let day = date.getUTCDate();
    let month = date.getUTCMonth();
    let year = date.getUTCFullYear();
    let months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ];
    month = months[month];

    return `${month} ${day}, ${year}`;

}

chrome.storage.local.get([
    'annotation',
    'date',
    'starred',
    'visibility'
], async function(result) {
    while (!document.getElementsByName('text')[0]){
        await sleep(1000)
    }
    let form = document.forms[0];
    let starred = document.getElementsByClassName('ga-star')[0];
    let datepicker = document.getElementsByClassName('annotation-datepicker')[0];

    form['text'].value = result.annotation;

    if(result.visibility !== 'Shared') {
        form[2].value = false;
        form[3].value = true;
    }
    if(result.starred){
        starred.click();
    }

    let date = new Date(Date.parse(result.date));
    form[0].value = formatDate(date);
    var tbEvent = new Event('change');
    var dateEvent = new KeyboardEvent('keydown', {keycode: 13});
    form['text'].dispatchEvent(tbEvent);
    form[0].focus();
    form[0].dispatchEvent(dateEvent);
    form[4].focus();
    form[4].click();
});