// ====================================================================
// VOCABULARY LEARNING APP - GEEK EDITION JS
// ====================================================================

let currentSubject = 'all'; 
let unsubscribeListener = null; 

// Initializing Console Style
console.log('%c > SYSTEM_BOOT_SEQUENCE: SUCCESS ', 'background: #00ff41; color: #020617; font-weight: bold;');

window.addEventListener('firebaseReady', () => {
    console.log('%c > FIREBASE_CONNECTION: ESTABLISHED ', 'color: #00ff41;');
    initializeApp();
});

function initializeApp() {
    const elements = {
        vocabForm: document.getElementById('vocabForm'),
        wordInput: document.getElementById('word'),
        meaningInput: document.getElementById('meaning'),
        exampleInput: document.getElementById('example'),
        subjectSelect: document.getElementById('subject'),
        submitBtn: document.getElementById('submitBtn'),
        resetBtn: document.getElementById('resetBtn'),
        toggleFormBtn: document.getElementById('toggleFormBtn'),
        formContainer: document.getElementById('formContainer'),
        message: document.getElementById('message'),
        subjectTabs: document.getElementById('subjectTabs'),
        vocabGrid: document.getElementById('vocabGrid'),
        loading: document.getElementById('loading'),
        emptyState: document.getElementById('emptyState'),
        vocabCount: document.getElementById('vocabCount')
    };

    // Verify all elements exist before attaching listeners
    for (const [key, value] of Object.entries(elements)) {
        if (!value) console.warn(`%c ! UI_WARNING: Element [${key}] not found in DOM`, 'color: #ff3333;');
    }

    setupEventListeners(elements);
    loadVocabulary('all');
}

function setupEventListeners(elements) {
    // Form Toggle Logic
    if (elements.toggleFormBtn) {
        elements.toggleFormBtn.addEventListener('click', () => {
            elements.formContainer.classList.toggle('show');
            const isActive = elements.formContainer.classList.contains('show');
            elements.toggleFormBtn.innerHTML = isActive ? `[ - ] HIDE_FORM` : `[ + ] PUSH_DATA`;
            console.log(`%c > UI_ACTION: FORM_TOGGLE -> ${isActive}`, 'color: #0ea5e9;');
        });
    }

    // Tab Switching Logic
    if (elements.subjectTabs) {
        elements.subjectTabs.addEventListener('click', (e) => {
            const tab = e.target.closest('.subject-tab');
            if (tab) {
                document.querySelectorAll('.subject-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const subject = tab.getAttribute('data-subject') || tab.innerText.toLowerCase();
                loadVocabulary(subject);
            }
        });
    }

    // Submit Logic
    if (elements.vocabForm) {
        elements.vocabForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleFormSubmit(elements);
        });
    }

    // Fetch Meaning Logic
    const fetchBtn = document.getElementById('fetchMeaningBtn');
    if (fetchBtn) {
        fetchBtn.addEventListener('click', async () => {
            await handleFetchMeaning(elements);
        });
    }
}

// Optimized Fetch Meaning (Dictionary API)
async function handleFetchMeaning(elements) {
    const word = elements.wordInput.value.trim();
    if (!word) {
        showStatus(elements.message, "ERROR: NULL_STRING_INPUT", "error");
        return;
    }

    setLoading(true);
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        const data = await response.json();
        
        if (data[0]) {
            const def = data[0].meanings[0].definitions[0].definition;
            elements.meaningInput.value = def;
            showStatus(elements.message, "QUERY_SUCCESS: DATA_RETRIEVED", "success");
        } else {
            showStatus(elements.message, "QUERY_FAILURE: WORD_NOT_FOUND", "error");
        }
    } catch (err) {
        showStatus(elements.message, "SYSTEM_ERROR: NETWORK_FAILURE", "error");
    } finally {
        setLoading(false);
    }
}

// --- UI HELPER FUNCTIONS ---

function showStatus(el, text, type) {
    if (!el) return;
    el.innerText = `>> ${text}`;
    el.className = `message show ${type}`;
    setTimeout(() => el.classList.remove('show'), 4000);
}

function setLoading(isLoading) {
    const loader = document.getElementById('loading');
    if (loader) isLoading ? loader.classList.add('show') : loader.classList.remove('show');
}

// Add this to match your CSS logic
function updateVocabCount(count) {
    const el = document.getElementById('vocabCount');
    if (el) el.innerText = `COUNT: ${count}_ENTRIES`;
}

console.log('%c > SCRIPTS_LOADED_VERSION: 2.0.0-GEEK ', 'color: #94a3b8; font-style: italic;');
