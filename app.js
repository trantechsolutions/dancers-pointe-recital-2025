const { useState, useEffect, useMemo, useRef } = React;

// --- Firebase Config is in config.js ---

// --- Firebase Services ---
const {
    initializeApp,
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInAnonymously,
    getFirestore,
    doc,
    onSnapshot,
    setDoc
} = window.firebase;

let app, auth, db, provider;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    provider = new GoogleAuthProvider();
} catch (e) {
    console.error("Firebase initialization failed. Make sure config.js is loaded correctly and contains your configuration details.");
}

// Reusable Icon Component
const Icon = ({ name, type = 'fas', ...props }) => <i className={`${type} fa-${name}`} {...props}></i>;

// Helper functions for localStorage
const saveFavoritesToLocalStorage = (favorites) => {
    try {
        localStorage.setItem('dancersPointeFavorites', JSON.stringify(Array.from(favorites)));
    } catch (error) {
        console.error("Error saving favorites:", error);
    }
};

const loadFavoritesFromLocalStorage = () => {
    try {
        const stored = localStorage.getItem('dancersPointeFavorites');
        return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (error) {
        return new Set();
    }
};

const formatShowDateTime = (datetime) => new Date(datetime).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });

// Main App Component
function App() {
    const [user, setUser] = useState(null);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [dancerSearch, setDancerSearch] = useState('');
    const [actSearch, setActSearch] = useState('');
    const [selectedShow, setSelectedShow] = useState('');
    const [favorites, setFavorites] = useState(new Set());
    const [activeTab, setActiveTab] = useState('program');
    const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(false);
    const [recitalData, setRecitalData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentAct, setCurrentAct] = useState({ number: null, title: '', isTracking: false });
    const [isTrackerSticky, setIsTrackerSticky] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
    
    const touchStartRef = useRef({ x: 0, y: 0 });
    const trackerRef = useRef(null);

    // --- Theme Management ---
    useEffect(() => {
        const applyTheme = (t) => {
            if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                document.body.classList.add('dark');
            } else {
                document.body.classList.remove('dark');
            }
        };
        applyTheme(theme);
        localStorage.setItem('theme', theme);

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => applyTheme(theme);
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);
    
    // --- Sticky Header Scroll Listener ---
    useEffect(() => {
        const handleScroll = () => {
            if (trackerRef.current) {
                setIsTrackerSticky(trackerRef.current.getBoundingClientRect().top < 0);
            } else {
                setIsTrackerSticky(false);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // --- Firebase Auth & Authorization ---
    useEffect(() => {
        if (!auth) return;
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setIsAuthorized(authorizedUsers.includes(currentUser.email));
            } else {
                signInAnonymously(auth).catch(err => console.error("Anonymous sign-in failed:", err));
            }
        });
        return () => unsubscribe();
    }, []);

    const handleSignIn = () => {
        if (!auth || !provider) return;
        signInWithPopup(auth, provider).catch(err => console.error("Sign-in failed:", err));
    };

    const handleSignOut = () => {
        if (!auth) return;
        auth.signOut().catch(err => console.error("Sign-out failed:", err));
    };
    
    // --- Live Act Number Listener ---
    useEffect(() => {
        if (!selectedShow || !db || !showData) {
            setCurrentAct({ number: null, title: '', isTracking: false });
            return;
        }
        const appId = 'dancers-pointe-app';
        const docRef = doc(db, `artifacts/${appId}/public/data/show_status`, selectedShow);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            const data = docSnap.exists() ? docSnap.data() : { currentActNumber: 1, isTracking: false };
            const act = showData.acts.find(a => a.number === data.currentActNumber);
            setCurrentAct({
                number: data.currentActNumber,
                title: act ? act.title : 'Act not found',
                isTracking: data.isTracking || false
            });
        }, (err) => console.error("Firestore snapshot error:", err));
        return () => unsubscribe();
    }, [selectedShow, showData]);
    
    const updateCurrentActNumber = async (newNumber) => {
        if (!selectedShow || !db || newNumber < 1 || !isAuthorized) return;
        const appId = 'dancers-pointe-app';
        const docRef = doc(db, `artifacts/${appId}/public/data/show_status`, selectedShow);
        try {
            await setDoc(docRef, { currentActNumber: newNumber, isTracking: true }, { merge: true });
        } catch (err) {
            console.error("Error updating act number:", err);
        }
    };
    
    const toggleTracking = async () => {
        if (!selectedShow || !db || !isAuthorized) return;
        const appId = 'dancers-pointe-app';
        const docRef = doc(db, `artifacts/${appId}/public/data/show_status`, selectedShow);
        try {
             await setDoc(docRef, { isTracking: !currentAct.isTracking }, { merge: true });
        } catch(err) {
            console.error("Error toggling tracking:", err);
        }
    };

    // --- Data Fetching & LocalStorage ---
    useEffect(() => {
        fetch('recital_data.dat')
            .then(res => res.blob())
            .then(blob => blob.text())
            .then(base64 => {
                const jsonStr = new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)));
                const data = JSON.parse(jsonStr);
                const transformed = data.shows.reduce((acc, show) => {
                    acc[show.datetime] = { label: formatShowDateTime(show.datetime), acts: show.acts };
                    return acc;
                }, {});
                setRecitalData(transformed);
                setLoading(false);
            })
            .catch(err => {
                setError('Failed to load recital data.');
                setLoading(false);
            });
    }, []);

    useEffect(() => setFavorites(loadFavoritesFromLocalStorage()), []);
    useEffect(() => saveFavoritesToLocalStorage(favorites), [favorites]);

    const shows = useMemo(() => recitalData ? Object.keys(recitalData).map(k => ({ label: recitalData[k].label, value: k })) : [], [recitalData]);
    const showData = selectedShow ? recitalData[selectedShow] : null;

    const dancerSearchResults = useMemo(() => {
        if (!dancerSearch.trim() || !showData) return [];
        const q = dancerSearch.toLowerCase();
        const map = {};
        showData.acts.forEach(act => {
            (act.performers || []).forEach(name => {
                if (name.toLowerCase().includes(q)) {
                    if (!map[name]) map[name] = [];
                    map[name].push({ number: act.number, title: act.title });
                }
            });
        });
        return Object.entries(map).map(([name, acts]) => ({ name, acts })).sort((a,b) => a.name.localeCompare(b.name));
    }, [dancerSearch, showData]);

    const actSearchResults = useMemo(() => {
        if (!actSearch.trim() || !showData) return [];
        const q = actSearch.toLowerCase();
        return showData.acts.filter(act => 
            act.title.toLowerCase().includes(q) || 
            String(act.number).includes(q) ||
            (act.performers || []).some(p => p.toLowerCase().includes(q))
        );
    }, [actSearch, showData]);

    const favoriteResults = useMemo(() => {
        if (!showData) return [];
        const map = {};
        const all = new Set();
        showData.acts.forEach(act => {
            (act.performers || []).forEach(p => {
                all.add(p);
                if (!map[p]) map[p] = [];
                map[p].push({ number: act.number, title: act.title });
            });
        });
        return Array.from(favorites).sort().map(name => ({ name, acts: map[name] || [], missing: !all.has(name) }));
    }, [favorites, showData]);
    
    const toggleFavorite = (name) => {
        setFavorites(p => {
            const n = new Set(p);
            n.has(name) ? n.delete(name) : n.add(name);
            return n;
        });
    };

    const handleTouchStart = (e) => { touchStartRef.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY }; };
    const handleTouchEnd = (e) => {
        const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
        const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
            const tabs = ['program', 'searchActs', 'searchDancers', 'settings'];
            const currentIndex = tabs.indexOf(activeTab);
            if (deltaX < 0) { // Swipe Left
                const nextIndex = (currentIndex + 1) % tabs.length;
                setActiveTab(tabs[nextIndex]);
            } else { // Swipe Right
                const nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                setActiveTab(tabs[nextIndex]);
            }
        }
    };
    
    // --- Render Logic ---
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;

    const renderMainContent = () => {
        if (activeTab === 'settings') {
            return <SettingsView theme={theme} setTheme={setTheme} user={user} handleSignIn={handleSignIn} handleSignOut={handleSignOut} />;
        }

        if (selectedShow) {
            switch (activeTab) {
                case 'program':
                    return <ProgramView showData={showData} favorites={favorites} currentAct={currentAct} />;
                case 'searchActs':
                    return <SearchActView search={actSearch} setSearch={setActSearch} results={actSearchResults} favorites={favorites} currentAct={currentAct} />;
                case 'searchDancers':
                     return <SearchDancerView search={dancerSearch} setSearch={setDancerSearch} results={dancerSearchResults} favorites={favorites} toggleFavorite={toggleFavorite} />;
                default:
                    return null;
            }
        }
        
        return <p style={{textAlign: 'center', color: '#6b7280', marginTop: '2rem'}}>Please select a show to continue.</p>;
    };

    return (
        <>
            {currentAct.isTracking && (
                <div className={`sticky-tracker ${isTrackerSticky ? 'visible' : ''}`}>
                    <div className="sticky-tracker-info">
                        <span>Now Performing:</span>
                        <span className="act-number">#{currentAct.number}</span>
                        <span className="act-title">{currentAct.title}</span>
                    </div>
                    {isAuthorized && (
                        <div className="controls">
                            <button onClick={() => updateCurrentActNumber(currentAct.number - 1)}><Icon name="minus" /></button>
                            <button onClick={() => updateCurrentActNumber(currentAct.number + 1)}><Icon name="plus" /></button>
                        </div>
                    )}
                </div>
            )}
            <div className="container" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <header className="header">
                    <h1>Dancer's Pointe</h1>
                    <p>Recital Program</p>
                </header>
                <main>
                    <div style={{ marginBottom: '1rem' }}>
                        <select value={selectedShow} onChange={(e) => setSelectedShow(e.target.value)}>
                            <option value="">-- Select a Show --</option>
                            {shows.map(show => <option key={show.value} value={show.value}>{show.label}</option>)}
                        </select>
                    </div>
                     {selectedShow && activeTab !== 'settings' && (
                        <>
                           {isAuthorized && (
                               <div className="admin-controls">
                                   <button 
                                       onClick={toggleTracking} 
                                       className={`tracking-toggle-button ${currentAct.isTracking ? 'on' : 'off'}`}
                                   >
                                       {currentAct.isTracking ? 'Stop Tracking' : 'Start Tracking'}
                                   </button>
                               </div>
                           )}
                           {currentAct.isTracking && (
                                <div className="now-performing" ref={trackerRef}>
                                    <h2>Now Performing</h2>
                                    <div className="act-number">#{currentAct.number}</div>
                                    <div className="act-title">{currentAct.title}</div>
                                    {isAuthorized && (
                                        <div className="controls">
                                            <button onClick={() => updateCurrentActNumber(currentAct.number - 1)}><Icon name="minus" /></button>
                                            <button onClick={() => updateCurrentActNumber(currentAct.number + 1)}><Icon name="plus" /></button>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="favorites-section">
                                <button onClick={() => setIsFavoritesExpanded(!isFavoritesExpanded)} className={`favorites-toggle ${isFavoritesExpanded ? 'expanded' : ''}`}>
                                    <span>My Favorites ({favorites.size})</span>
                                    <div className="icon-container"><Icon name="chevron-down" /></div>
                                </button>
                                {isFavoritesExpanded && (
                                    <div className="favorites-content">
                                        {favoriteResults.length > 0 ? (
                                            favoriteResults.map(fav => (
                                                <div key={fav.name} className="favorite-item">
                                                    <div className="favorite-header">
                                                        <h3>{fav.name}</h3>
                                                        <button onClick={() => toggleFavorite(fav.name)}>
                                                             <div className="icon-container" style={{color: '#db2777'}}><Icon name="star" type="fas"/></div>
                                                        </button>
                                                    </div>
                                                    <div className="favorite-acts">
                                                        {fav.missing ? <em style={{color: '#ef4444'}}>Not in this show</em> : fav.acts.map((act, i) => <div key={i}>#{act.number} &mdash; {act.title}</div>)}
                                                    </div>
                                                </div>
                                            ))
                                        ) : <p>No favorites added yet.</p>}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    {renderMainContent()}
                </main>
                <nav className="bottom-nav">
                    <button onClick={() => setActiveTab('program')} className={activeTab === 'program' ? 'active' : ''}>
                       <div className="icon-container"><Icon name="list" /></div>
                        <span>Program</span>
                    </button>
                     <button onClick={() => setActiveTab('searchActs')} className={activeTab === 'searchActs' ? 'active' : ''}>
                        <div className="icon-container"><Icon name="magnifying-glass" /></div>
                        <span>Acts</span>
                    </button>
                    <button onClick={() => setActiveTab('searchDancers')} className={activeTab === 'searchDancers' ? 'active' : ''}>
                        <div className="icon-container"><Icon name="user-group" /></div>
                        <span>Dancers</span>
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={activeTab === 'settings' ? 'active' : ''}>
                        <div className="icon-container"><Icon name="gear" /></div>
                        <span>Settings</span>
                    </button>
                </nav>
            </div>
        </>
    );
}

function ProgramView({ showData, favorites, currentAct }) {
    if (!showData) return null;
    return (
        <div className="program-view">
            <h2>Program</h2>
            {showData.acts.map(act => {
                const isFav = (act.performers || []).some(p => favorites.has(p));
                const isCurrent = currentAct.isTracking && act.number === currentAct.number;
                return (
                    <div key={act.number} className={`act-card ${isFav ? 'favorite' : ''} ${isCurrent ? 'current-act' : ''}`}>
                        <p>{act.number} - {act.title}</p>
                        {act.performers && act.performers.length > 0 && <div className="performers"><strong>Performers:</strong> {act.performers.join(', ')}</div>}
                    </div>
                )
            })}
        </div>
    );
}

function SearchActView({ search, setSearch, results, favorites, currentAct }) {
    return (
        <div className="search-view">
             <h2>Search Acts</h2>
            <input type="text" placeholder="Search by act, title, or dancer..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && results.length === 0 && <p style={{textAlign: 'center', color: '#6b7280'}}>No acts found.</p>}
            {results.length > 0 && (
                <div>
                    {results.map(act => {
                        const isFav = (act.performers || []).some(p => favorites.has(p));
                        const isCurrent = currentAct.isTracking && act.number === currentAct.number;
                        return (
                            <div key={`${act.number}-search`} className={`act-card ${isFav ? 'favorite' : ''} ${isCurrent ? 'current-act' : ''}`}>
                                <p>{act.number} - {act.title}</p>
                                {act.performers && act.performers.length > 0 && <div className="performers"><strong>Performers:</strong> {act.performers.join(', ')}</div>}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}

function SearchDancerView({ search, setSearch, results, favorites, toggleFavorite }) {
    return (
        <div className="search-view">
             <h2>Search Dancers</h2>
            <input type="text" placeholder="Search for a dancer..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && results.length === 0 && <p style={{textAlign: 'center', color: '#6b7280'}}>No dancers found.</p>}
            {results.length > 0 && (
                <ul className="search-result-list">
                    {results.map(result => {
                        const isFavorite = favorites.has(result.name);
                        return (
                            <li key={result.name} className="search-result-item">
                                <div className="search-result-header">
                                    <div style={{flex: 1}}>
                                        <h3>{result.name}</h3>
                                        <div className="favorite-acts">
                                            {result.acts.map((act, i) => <div key={i}>#{act.number} &mdash; {act.title}</div>)}
                                        </div>
                                    </div>
                                    <button onClick={() => toggleFavorite(result.name)}>
                                         <div className="icon-container" style={{ color: isFavorite ? '#db2777' : '#9ca3af' }}>
                                            <Icon name="star" type={isFavorite ? 'fas' : 'far'} />
                                         </div>
                                    </button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    );
}

function SettingsView({ theme, setTheme, user, handleSignIn, handleSignOut }) {
    return (
        <div className="settings-view">
            <h2>Settings</h2>
            <div className="settings-section">
                <h3>Theme</h3>
                <div className="theme-switcher">
                    <button onClick={() => setTheme('light')} className={theme === 'light' ? 'active' : ''}>Light</button>
                    <button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'active' : ''}>Dark</button>
                    <button onClick={() => setTheme('system')} className={theme === 'system' ? 'active' : ''}>System</button>
                </div>
            </div>
            <div className="settings-section">
                <h3>Account</h3>
                {user && user.isAnonymous ? (
                    <button className="signin-button large" onClick={handleSignIn}>
                        <Icon name="google" type="fab" /> Admin Sign-In
                    </button>
                ) : (
                    <button onClick={handleSignOut} className="signin-button large">
                        Sign Out
                    </button>
                )}
            </div>
        </div>
    );
}


ReactDOM.render(<App />, document.getElementById('root'));
