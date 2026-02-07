// ====================================================================
// VOCABULARY LEARNING APP - MAIN JAVASCRIPT
// Firebase Integration with Real-time Updates
// ====================================================================

// ====================================================================
// GLOBAL STATE & CONFIGURATION
// ====================================================================
let currentSubject = 'all'; // Track currently selected subject
let unsubscribeListener = null; // Store Firestore listener for cleanup

// ====================================================================
// WAIT FOR FIREBASE TO BE READY
// ====================================================================
window.addEventListener('firebaseReady', () => {
    console.log('Firebase initialized successfully');
    initializeApp();
});

// ====================================================================
// INITIALIZE APPLICATION
// ====================================================================
function initializeApp() {
    // Get DOM elements
    const elements = {
        // Form elements
        vocabForm: document.getElementById('vocabForm'),
        wordInput: document.getElementById('word'),
        meaningInput: document.getElementById('meaning'),
        exampleInput: document.getElementById('example'),
        subjectSelect: document.getElementById('subject'),
        submitBtn: document.getElementById('submitBtn'),
        resetBtn: document.getElementById('resetBtn'),
        btnLoader: document.getElementById('btnLoader'),
        btnText: document.getElementById('btnText'),
        
        // UI elements
        toggleFormBtn: document.getElementById('toggleFormBtn'),
        formContainer: document.getElementById('formContainer'),
        message: document.getElementById('message'),
        
        // Display elements
        subjectTabs: document.getElementById('subjectTabs'),
        vocabGrid: document.getElementById('vocabGrid'),
        loading: document.getElementById('loading'),
        emptyState: document.getElementById('emptyState'),
        currentSubjectTitle: document.getElementById('currentSubjectTitle'),
        vocabCount: document.getElementById('vocabCount')
    };

    // Setup event listeners
    setupEventListeners(elements);
    
    // Load initial vocabulary (all subjects)
    loadVocabulary('all');
}

// ====================================================================
// EVENT LISTENERS SETUP
// ====================================================================
function setupEventListeners(elements) {
    // Form toggle
    elements.toggleFormBtn.addEventListener('click', () => {
        elements.formContainer.classList.toggle('show');
        elements.toggleFormBtn.classList.toggle('active');
        
        const btnText = elements.toggleFormBtn.querySelector('.btn-text');
        btnText.textContent = elements.formContainer.classList.contains('show') 
            ? 'Hide Form' 
            : 'Show Form';
    });

    // Form submission
    elements.vocabForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleFormSubmit(elements);
    });

    // Reset button
    elements.resetBtn.addEventListener('click', () => {
        elements.vocabForm.reset();
        hideMessage(elements.message);
        hideMeaningSuggestions();
    });

    // Subject tab clicks
    elements.subjectTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('subject-tab')) {
            handleSubjectChange(e.target, elements);
        }
    });

    // Fetch meaning button
    const fetchMeaningBtn = document.getElementById('fetchMeaningBtn');
    if (fetchMeaningBtn) {
        fetchMeaningBtn.addEventListener('click', async () => {
            await handleFetchMeaning(elements);
        });
    }
}

// ====================================================================
// FORM SUBMISSION HANDLER
// ====================================================================
async function handleFormSubmit(elements) {
    // Get form values
    const word = elements.wordInput.value.trim();
    const meaning = elements.meaningInput.value.trim();
    const example = elements.exampleInput.value.trim();
    const subject = elements.subjectSelect.value;

    // Validate inputs
    if (!word || !meaning || !subject) {
        showMessage(elements.message, 'Please fill in all required fields', 'error');
        return;
    }

    // Show loading state
    setButtonLoading(elements.submitBtn, true);

    try {
        // Prepare vocabulary data
        const vocabData = {
            word: word,
            meaning: meaning,
            example: example || null,
            subject: subject,
            addedAt: window.firebaseModules.Timestamp.now()
        };

        // Add to Firestore
        const { collection, addDoc } = window.firebaseModules;
        const docRef = await addDoc(collection(window.db, 'vocabulary'), vocabData);

        console.log('Vocabulary added with ID:', docRef.id);

        // Show success message
        showMessage(elements.message, '✓ Vocabulary added successfully!', 'success');

        // Reset form
        elements.vocabForm.reset();
        hideMeaningSuggestions();

        // Auto-hide success message after 3 seconds
        setTimeout(() => {
            hideMessage(elements.message);
        }, 3000);

    } catch (error) {
        console.error('Error adding vocabulary:', error);
        showMessage(elements.message, 'Error adding vocabulary. Please try again.', 'error');
    } finally {
        // Remove loading state
        setButtonLoading(elements.submitBtn, false);
    }
}

// ====================================================================
// FETCH MEANING FROM INTERNET
// ====================================================================
async function handleFetchMeaning(elements) {
    const word = elements.wordInput.value.trim();
    
    // Validate word input
    if (!word) {
        showMessage(elements.message, 'Please enter a word first', 'error');
        elements.wordInput.focus();
        return;
    }

    const fetchBtn = document.getElementById('fetchMeaningBtn');
    setButtonLoading(fetchBtn, true);
    hideMessage(elements.message);

    try {
        // Fetch meaning from Dictionary API
        const meanings = await fetchWordMeaning(word);
        
        if (meanings && meanings.length > 0) {
            displayMeaningSuggestions(meanings, elements);
        } else {
            showMessage(elements.message, 'No definitions found. Try a different word or enter manually.', 'error');
        }
    } catch (error) {
        console.error('Error fetching meaning:', error);
        showMessage(elements.message, 'Could not fetch meaning. Please enter it manually.', 'error');
    } finally {
        setButtonLoading(fetchBtn, false);
    }
}

// ====================================================================
// FETCH WORD MEANING FROM WEB SEARCH
// ====================================================================
async function fetchWordMeaning(word) {
    try {
        // Method 1: Try Wikitionary API (community-driven, Google-quality definitions)
        const wikiMeanings = await fetchFromWikitionary(word);
        if (wikiMeanings && wikiMeanings.length > 0) {
            return wikiMeanings;
        }

        // Method 2: Try Dictionary API as fallback
        const dictMeanings = await fetchFromDictionaryAPI(word);
        if (dictMeanings && dictMeanings.length > 0) {
            return dictMeanings;
        }

        // Method 3: Try WordsAPI (another reliable source)
        const wordsMeanings = await fetchFromWordsAPI(word);
        if (wordsMeanings && wordsMeanings.length > 0) {
            return wordsMeanings;
        }

        return [];
    } catch (error) {
        console.error('Error fetching meaning:', error);
        return [];
    }
}

// ====================================================================
// FETCH FROM WIKITIONARY (Wikipedia's Dictionary)
// ====================================================================
async function fetchFromWikitionary(word) {
    try {
        const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Word not found in Wiktionary');
        }

        const data = await response.json();
        const meanings = [];

        // Wiktionary returns definitions organized by language
        if (data.en && data.en.length > 0) {
            data.en.forEach((entry, index) => {
                if (index < 3 && entry.definitions && entry.definitions.length > 0) {
                    entry.definitions.forEach((def, defIndex) => {
                        if (defIndex < 2 && meanings.length < 3) {
                            // Clean the definition text (remove HTML tags)
                            const cleanDef = def.definition.replace(/<[^>]*>/g, '').trim();
                            
                            if (cleanDef && cleanDef.length > 10) {
                                meanings.push({
                                    partOfSpeech: entry.partOfSpeech || 'definition',
                                    definition: cleanDef,
                                    example: def.examples && def.examples.length > 0 ? def.examples[0] : null
                                });
                            }
                        }
                    });
                }
            });
        }

        return meanings;
    } catch (error) {
        console.error('Wiktionary fetch error:', error);
        return [];
    }
}

// ====================================================================
// FETCH FROM DICTIONARY API (Fallback 1)
// ====================================================================
async function fetchFromDictionaryAPI(word) {
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
        
        if (!response.ok) {
            throw new Error('Word not found');
        }

        const data = await response.json();
        const meanings = [];

        if (data && data.length > 0) {
            const wordData = data[0];
            
            wordData.meanings.forEach((meaning, index) => {
                if (index < 3 && meaning.definitions && meaning.definitions.length > 0) {
                    const def = meaning.definitions[0];
                    meanings.push({
                        partOfSpeech: meaning.partOfSpeech || 'definition',
                        definition: def.definition,
                        example: def.example || null
                    });
                }
            });
        }

        return meanings;
    } catch (error) {
        console.error('Dictionary API error:', error);
        return [];
    }
}

// ====================================================================
// FETCH FROM WORDS API (Fallback 2)
// ====================================================================
async function fetchFromWordsAPI(word) {
    try {
        // Note: This is a free tier of WordsAPI that doesn't require authentication
        // for basic lookups
        const response = await fetch(`https://wordsapiv1.p.rapidapi.com/words/${encodeURIComponent(word)}`, {
            headers: {
                'X-RapidAPI-Key': 'DEMO', // Using demo mode
            }
        });
        
        if (!response.ok) {
            throw new Error('Word not found');
        }

        const data = await response.json();
        const meanings = [];

        if (data.results && data.results.length > 0) {
            data.results.slice(0, 3).forEach((result) => {
                if (result.definition) {
                    meanings.push({
                        partOfSpeech: result.partOfSpeech || 'definition',
                        definition: result.definition,
                        example: result.examples && result.examples.length > 0 ? result.examples[0] : null
                    });
                }
            });
        }

        return meanings;
    } catch (error) {
        console.error('WordsAPI error:', error);
        return [];
    }
}

// ====================================================================
// DISPLAY MEANING SUGGESTIONS
// ====================================================================
function displayMeaningSuggestions(meanings, elements) {
    const suggestionsBox = document.getElementById('meaningSuggestions');
    
    if (!suggestionsBox) return;

    // Clear previous suggestions
    suggestionsBox.innerHTML = '';

    // Create header
    const header = document.createElement('div');
    header.className = 'suggestions-header';
    header.innerHTML = `
        <div class="suggestions-title">
            <span>📖</span>
            <span>Select a definition (click to use)</span>
        </div>
        <button type="button" class="close-suggestions" onclick="hideMeaningSuggestions()">×</button>
    `;
    suggestionsBox.appendChild(header);

    // Create suggestion items
    if (meanings.length > 0) {
        meanings.forEach((meaning, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.innerHTML = `
                <div class="suggestion-label">${meaning.partOfSpeech}</div>
                <div class="suggestion-text">${meaning.definition}</div>
                ${meaning.example ? `<div class="suggestion-source">Example: "${meaning.example}"</div>` : ''}
            `;
            
            // Click handler to populate the form
            item.addEventListener('click', () => {
                elements.meaningInput.value = meaning.definition;
                if (meaning.example && !elements.exampleInput.value) {
                    elements.exampleInput.value = meaning.example;
                }
                hideMeaningSuggestions();
                showMessage(elements.message, '✓ Definition added! You can edit it before submitting.', 'success');
                setTimeout(() => hideMessage(elements.message), 3000);
            });
            
            suggestionsBox.appendChild(item);
        });
    } else {
        const noResults = document.createElement('div');
        noResults.className = 'no-suggestions';
        noResults.innerHTML = `
            <div class="no-suggestions-icon">📚</div>
            <div>No definitions found. Please enter the meaning manually.</div>
        `;
        suggestionsBox.appendChild(noResults);
    }

    // Show suggestions box
    suggestionsBox.classList.add('show');
}

// ====================================================================
// HIDE MEANING SUGGESTIONS
// ====================================================================
function hideMeaningSuggestions() {
    const suggestionsBox = document.getElementById('meaningSuggestions');
    if (suggestionsBox) {
        suggestionsBox.classList.remove('show');
    }
}

// ====================================================================
// LOAD VOCABULARY FROM FIRESTORE
// ====================================================================
function loadVocabulary(subject) {
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('emptyState');
    const vocabGrid = document.getElementById('vocabGrid');

    // Show loading state
    loading.classList.add('show');
    emptyState.classList.remove('show');
    vocabGrid.innerHTML = '';

    // Unsubscribe from previous listener if exists
    if (unsubscribeListener) {
        unsubscribeListener();
    }

    const { collection, query, orderBy, where, onSnapshot } = window.firebaseModules;

    // Build query based on subject filter
    let vocabQuery;
    if (subject === 'all') {
        vocabQuery = query(
            collection(window.db, 'vocabulary'),
            orderBy('addedAt', 'desc')
        );
    } else {
        vocabQuery = query(
            collection(window.db, 'vocabulary'),
            where('subject', '==', subject),
            orderBy('addedAt', 'desc')
        );
    }

    // Set up real-time listener
    unsubscribeListener = onSnapshot(vocabQuery, (snapshot) => {
        // Hide loading
        loading.classList.remove('show');

        // Check if we have any results
        if (snapshot.empty) {
            emptyState.classList.add('show');
            vocabGrid.innerHTML = '';
            updateVocabCount(0);
            return;
        }

        // Clear grid and populate with vocabulary cards
        vocabGrid.innerHTML = '';
        emptyState.classList.remove('show');

        snapshot.forEach((doc) => {
            const vocab = doc.data();
            const card = createVocabCard(vocab);
            vocabGrid.appendChild(card);
        });

        // Update count
        updateVocabCount(snapshot.size);

    }, (error) => {
        console.error('Error loading vocabulary:', error);
        loading.classList.remove('show');
        showErrorInGrid(vocabGrid, 'Error loading vocabulary. Please refresh the page.');
    });
}

// ====================================================================
// CREATE VOCABULARY CARD ELEMENT
// ====================================================================
function createVocabCard(vocab) {
    // Create card container
    const card = document.createElement('div');
    card.className = 'vocab-card';

    // Create card header with word and subject
    const header = document.createElement('div');
    header.className = 'vocab-header';

    const wordElement = document.createElement('h3');
    wordElement.className = 'vocab-word';
    wordElement.textContent = vocab.word;

    const subjectBadge = document.createElement('span');
    subjectBadge.className = 'vocab-subject';
    subjectBadge.textContent = vocab.subject;

    header.appendChild(wordElement);
    header.appendChild(subjectBadge);

    // Create meaning element
    const meaningElement = document.createElement('p');
    meaningElement.className = 'vocab-meaning';
    meaningElement.textContent = vocab.meaning;

    // Append header and meaning to card
    card.appendChild(header);
    card.appendChild(meaningElement);

    // Add example if exists
    if (vocab.example && vocab.example.trim() !== '') {
        const exampleElement = document.createElement('div');
        exampleElement.className = 'vocab-example';
        exampleElement.textContent = vocab.example;
        card.appendChild(exampleElement);
    }

    return card;
}

// ====================================================================
// HANDLE SUBJECT CHANGE
// ====================================================================
function handleSubjectChange(clickedTab, elements) {
    // Remove active class from all tabs
    const allTabs = document.querySelectorAll('.subject-tab');
    allTabs.forEach(tab => tab.classList.remove('active'));

    // Add active class to clicked tab
    clickedTab.classList.add('active');

    // Get selected subject
    const subject = clickedTab.getAttribute('data-subject');
    currentSubject = subject;

    // Update title
    const titleText = subject === 'all' ? 'All Vocabulary' : `${subject} Vocabulary`;
    elements.currentSubjectTitle.textContent = titleText;

    // Load vocabulary for selected subject
    loadVocabulary(subject);
}

// ====================================================================
// UPDATE VOCABULARY COUNT
// ====================================================================
function updateVocabCount(count) {
    const vocabCount = document.getElementById('vocabCount');
    vocabCount.textContent = `${count} ${count === 1 ? 'word' : 'words'}`;
}

// ====================================================================
// SHOW ERROR IN GRID
// ====================================================================
function showErrorInGrid(gridElement, message) {
    gridElement.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--error-color);">
            <p>${message}</p>
        </div>
    `;
}

// ====================================================================
// MESSAGE HELPERS
// ====================================================================
function showMessage(messageElement, text, type) {
    messageElement.textContent = text;
    messageElement.className = `message show ${type}`;
}

function hideMessage(messageElement) {
    messageElement.classList.remove('show');
    setTimeout(() => {
        messageElement.className = 'message';
    }, 300);
}

// ====================================================================
// BUTTON LOADING STATE
// ====================================================================
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
    } else {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// ====================================================================
// UTILITY FUNCTIONS
// ====================================================================

/**
 * Format timestamp to readable date
 * @param {Timestamp} timestamp - Firebase Timestamp
 * @returns {string} Formatted date string
 */
function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return '';
    
    const date = timestamp.toDate();
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    return date.toLocaleDateString('en-US', options);
}

/**
 * Sanitize user input to prevent XSS
 * @param {string} text - Input text
 * @returns {string} Sanitized text
 */
function sanitizeInput(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ====================================================================
// CLEANUP ON PAGE UNLOAD
// ====================================================================
window.addEventListener('beforeunload', () => {
    // Unsubscribe from Firestore listener to prevent memory leaks
    if (unsubscribeListener) {
        unsubscribeListener();
    }
});

// ====================================================================
// ERROR HANDLING FOR FIREBASE NOT LOADED
// ====================================================================
setTimeout(() => {
    if (!window.db) {
        console.error('Firebase not initialized. Please check your configuration.');
        const vocabGrid = document.getElementById('vocabGrid');
        const loading = document.getElementById('loading');
        
        if (loading) loading.classList.remove('show');
        
        if (vocabGrid) {
            vocabGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--error-color);">
                    <h3>Firebase Configuration Error</h3>
                    <p>Please configure Firebase in index.html</p>
                    <p style="margin-top: 1rem; font-size: 0.875rem; color: var(--text-secondary);">
                        See setup instructions in the README
                    </p>
                </div>
            `;
        }
    }
}, 3000);

console.log('Vocabulary Learning App - Script Loaded');
