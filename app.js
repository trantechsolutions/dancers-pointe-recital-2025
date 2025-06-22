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
    console.error("Firebase initialization failed. Make sure config.js is loaded correctly.");
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
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'system');
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
    
    const touchStartRef = useRef({ x: 0, y: 0 });
    const trackerRef = useRef(null);

    // --- Theme Management ---
    useEffect(() => {
        const applyTheme = (t) => {
            let newTheme = t;
            if (t === 'system') {
                newTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            document.documentElement.setAttribute('data-bs-theme', newTheme);
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
    }, [currentAct.isTracking]);

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

    const handleTouchStart = (e) => {
        touchStartRef.current = { x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY };
    };

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

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'program':
                return <ProgramView showData={showData} favorites={favorites} currentAct={currentAct} />;
            case 'searchActs':
                return <SearchActView search={actSearch} setSearch={setActSearch} results={actSearchResults} favorites={favorites} currentAct={currentAct} />;
            case 'searchDancers':
                 return <SearchDancerView search={dancerSearch} setSearch={setDancerSearch} results={dancerSearchResults} favorites={favorites} toggleFavorite={toggleFavorite} />;
            case 'settings':
                return <SettingsView theme={theme} setTheme={setTheme} user={user} handleSignIn={handleSignIn} handleSignOut={handleSignOut} />;
            default:
                return <ProgramView showData={showData} favorites={favorites} currentAct={currentAct} />;
        }
    };

    return (
        <>
            {currentAct.isTracking && (
                <div className={`sticky-tracker p-2 d-flex justify-content-between align-items-center shadow ${isTrackerSticky ? 'visible' : ''}`}>
                    <div className="sticky-tracker-info">
                        <span className="fw-bold">Now:</span>
                        <span className="act-number mx-2">#{currentAct.number}</span>
                        <span className="act-title text-truncate">{currentAct.title}</span>
                    </div>
                    {isAuthorized && (
                        <div className="controls">
                            <button className="btn btn-sm btn-light rounded-circle" onClick={() => updateCurrentActNumber(currentAct.number - 1)}><Icon name="minus" /></button>
                            <button className="btn btn-sm btn-light rounded-circle ms-1" onClick={() => updateCurrentActNumber(currentAct.number + 1)}><Icon name="plus" /></button>
                        </div>
                    )}
                </div>
            )}
            <div className="container py-4" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                <header className="header text-center mb-4">
                    <h1 className="fw-bold">Dancer's Pointe</h1>
                    <p className="text-muted">Recital Program</p>
                </header>
                <main>
                    {activeTab !== 'settings' && (
                         <div className="mb-3">
                            <select className="form-select" value={selectedShow} onChange={(e) => setSelectedShow(e.target.value)}>
                                <option value="">-- Select a Show --</option>
                                {shows.map(show => <option key={show.value} value={show.value}>{show.label}</option>)}
                            </select>
                        </div>
                    )}

                    {selectedShow || activeTab === 'settings' ? (
                        <>
                           {isAuthorized && activeTab !== 'settings' && (
                               <div className="d-grid mb-3">
                                   <button 
                                       onClick={toggleTracking} 
                                       className={`btn ${currentAct.isTracking ? 'btn-danger' : 'btn-success'}`}
                                   >
                                       {currentAct.isTracking ? 'Stop Tracking' : 'Start Tracking'}
                                   </button>
                               </div>
                           )}

                            {currentAct.isTracking && activeTab !== 'settings' && (
                                <div className="now-performing text-white p-3 rounded mb-3 shadow text-center" ref={trackerRef}>
                                    <h2 className="h6 text-uppercase">Now Performing</h2>
                                    <div className="display-4 fw-bold">#{currentAct.number}</div>
                                    <div className="h5 mt-1">{currentAct.title}</div>
                                    {isAuthorized && (
                                        <div className="controls mt-3">
                                            <button className="btn btn-light rounded-circle" onClick={() => updateCurrentActNumber(currentAct.number - 1)}><Icon name="minus" /></button>
                                            <button className="btn btn-light rounded-circle ms-2" onClick={() => updateCurrentActNumber(currentAct.number + 1)}><Icon name="plus" /></button>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            {activeTab !== 'settings' && (
                                <div className="accordion mb-3" id="favoritesAccordion">
                                    <div className="accordion-item">
                                        <h2 className="accordion-header">
                                            <button className="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseFavorites">
                                                My Favorites ({favorites.size})
                                            </button>
                                        </h2>
                                        <div id="collapseFavorites" className="accordion-collapse collapse">
                                            <div className="accordion-body">
                                                {favoriteResults.length > 0 ? (
                                                    favoriteResults.map(fav => (
                                                        <div key={fav.name} className="mb-2">
                                                            <div className="d-flex justify-content-between align-items-center">
                                                                <h3 className="h6 mb-0">{fav.name}</h3>
                                                                <button className="btn btn-sm" onClick={() => toggleFavorite(fav.name)}>
                                                                    <div className="icon-container favorite-icon"><Icon name="star" type="fas"/></div>
                                                                </button>
                                                            </div>
                                                            <div className="small text-muted">
                                                                {fav.missing ? <em>Not in this show</em> : fav.acts.map((act, i) => <div key={i}>#{act.number} &mdash; {act.title}</div>)}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : <p>No favorites added yet.</p>}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {renderActiveTab()}
                        </>
                    ) : (
                        <p className="text-center text-muted">Please select a show to begin.</p>
                    )}
                </main>
            </div>
             <nav className="bottom-nav navbar fixed-bottom">
                <div className="container-fluid d-flex justify-content-around">
                    <button onClick={() => setActiveTab('program')} className={`btn flex-grow-1 ${activeTab === 'program' ? 'active' : ''}`}>
                       <div><Icon name="list" /></div><div className="small">Program</div>
                    </button>
                     <button onClick={() => setActiveTab('searchActs')} className={`btn flex-grow-1 ${activeTab === 'searchActs' ? 'active' : ''}`}>
                        <div><Icon name="magnifying-glass" /></div><div className="small">Acts</div>
                    </button>
                    <button onClick={() => setActiveTab('searchDancers')} className={`btn flex-grow-1 ${activeTab === 'searchDancers' ? 'active' : ''}`}>
                        <div><Icon name="user-group" /></div><div className="small">Dancers</div>
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={`btn flex-grow-1 ${activeTab === 'settings' ? 'active' : ''}`}>
                        <div><Icon name="gear" /></div><div className="small">Settings</div>
                    </button>
                </div>
            </nav>
        </>
    );
}

function ProgramView({ showData, favorites, currentAct }) {
    if (!showData) return <p className="text-center text-muted mt-4">Select a show to see the program.</p>;
    return (
        <div>
            <h2 className="h4">Program</h2>
            {showData.acts.map(act => {
                const isFav = (act.performers || []).some(p => favorites.has(p));
                const isCurrent = currentAct.isTracking && act.number === currentAct.number;
                return (
                    <div key={act.number} className={`card mb-2 act-card ${isFav ? 'favorite' : ''} ${isCurrent ? 'current-act' : ''}`}>
                        <div className="card-body">
                            <p className="card-title fw-bold">{act.number} - {act.title}</p>
                            {act.performers && act.performers.length > 0 && <p className="card-text small"><strong>Performers:</strong> {act.performers.join(', ')}</p>}
                        </div>
                    </div>
                )
            })}
        </div>
    );
}

function SearchActView({ search, setSearch, results, favorites, currentAct }) {
    return (
        <div>
             <h2 className="h4">Search Acts</h2>
            <input type="text" className="form-control mb-3" placeholder="Search by act, title, or dancer..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && results.length === 0 && <p className="text-center text-muted">No acts found.</p>}
            {results.length > 0 && (
                <div>
                    {results.map(act => {
                        const isFav = (act.performers || []).some(p => favorites.has(p));
                        const isCurrent = currentAct.isTracking && act.number === currentAct.number;
                        return (
                            <div key={`${act.number}-search`} className={`card mb-2 act-card ${isFav ? 'favorite' : ''} ${isCurrent ? 'current-act' : ''}`}>
                                 <div className="card-body">
                                    <p className="card-title fw-bold">{act.number} - {act.title}</p>
                                    {act.performers && act.performers.length > 0 && <p className="card-text small"><strong>Performers:</strong> {act.performers.join(', ')}</p>}
                                </div>
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
        <div>
             <h2 className="h4">Search Dancers</h2>
            <input type="text" className="form-control mb-3" placeholder="Search for a dancer..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && results.length === 0 && <p className="text-center text-muted">No dancers found.</p>}
            {results.length > 0 && (
                <ul className="list-group">
                    {results.map(result => {
                        const isFavorite = favorites.has(result.name);
                        return (
                            <li key={result.name} className="list-group-item d-flex justify-content-between align-items-start">
                                <div className="me-auto">
                                    <div className="fw-bold">{result.name}</div>
                                    <div className="small text-muted">
                                        {result.acts.map((act, i) => <div key={i}>#{act.number} &mdash; {act.title}</div>)}
                                    </div>
                                </div>
                                <button className="btn btn-sm" onClick={() => toggleFavorite(result.name)}>
                                     <div className={`icon-container favorite-icon ${!isFavorite ? 'inactive' : ''}`}>
                                        <Icon name="star" type={isFavorite ? 'fas' : 'far'} />
                                     </div>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    );
}

function SettingsView({ theme, setTheme, user, handleSignIn, handleSignOut }) {
    const [changelogVisible, setChangelogVisible] = useState(false);
    const [changelogContent, setChangelogContent] = useState('');

    useEffect(() => {
        if (changelogVisible && !changelogContent) {
            fetch('CHANGELOG.md')
                .then(res => res.text())
                .then(text => setChangelogContent(text))
                .catch(() => setChangelogContent('Could not load changelog.'));
        }
    }, [changelogVisible]);

    return (
        <div className="settings-view">
            <h2 className="h4">Settings</h2>
            <div className="card mb-3">
                <div className="card-body">
                    <h3 className="card-title h6">Theme</h3>
                     <div className="btn-group w-100">
                        <button onClick={() => setTheme('light')} className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}>Light</button>
                        <button onClick={() => setTheme('dark')} className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}>Dark</button>
                        <button onClick={() => setTheme('system')} className={`btn ${theme === 'system' ? 'btn-primary' : 'btn-secondary'}`}>System</button>
                    </div>
                </div>
            </div>
            <div className="card mb-3">
                <div className="card-body">
                    <h3 className="card-title h6">Account</h3>
                    {user && user.isAnonymous ? (
                        <button className="btn btn-primary w-100" onClick={handleSignIn}>
                            <Icon name="google" type="fab" /> Admin Sign-In
                        </button>
                    ) : (
                        <button className="btn btn-secondary w-100" onClick={handleSignOut}>
                            Sign Out ({user ? user.email : ''})
                        </button>
                    )}
                </div>
            </div>
             <div className="card">
                <div className="card-body">
                     <h3 className="card-title h6">About</h3>
                    <div className="d-grid">
                        <button className="btn btn-outline-secondary" onClick={() => setChangelogVisible(!changelogVisible)}>
                            {changelogVisible ? 'Hide' : 'Show'} Changelog
                        </button>
                    </div>
                    {changelogVisible && (
                         <div className="mt-3" dangerouslySetInnerHTML={{ __html: window.marked ? window.marked.parse(changelogContent) : 'Loading...' }} />
                    )}
                </div>
            </div>
        </div>
    );
}

const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);
root.render(<App />);
