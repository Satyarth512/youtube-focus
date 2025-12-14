document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['apiKey'], (items) => {
        if (items.apiKey) document.getElementById('apiKey').value = items.apiKey;
    });
});

document.getElementById('save').addEventListener('click', () => {
    const apiKey = document.getElementById('apiKey').value;

    chrome.storage.local.set({ apiKey }, () => {
        const status = document.getElementById('status');
        status.style.display = 'block';
        setTimeout(() => { status.style.display = 'none'; }, 2000);
    });
});
