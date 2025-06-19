const { useState, useEffect, useMemo, useRef } = React;

// Reusable Icon Component using Font Awesome
const Icon = ({ name, type = 'fas', ...props }) => {
    const className = `${type} fa-${name}`;
    return <i className={className} {...props}></i>;
};

// Helper functions for localStorage
const saveFavoritesToLocalStorage = (favorites) => {
    try {
        localStorage.setItem('dancersPointeFavorites', JSON.stringify(Array.from(favorites)));
    } catch (error) {
        console.error("Error saving favorites to localStorage: ", error);
    }
};

const loadFavoritesFromLocalStorage = () => {
    try {
        const storedFavorites = localStorage.getItem('dancersPointeFavorites');
        return storedFavorites ? new Set(JSON.parse(storedFavorites)) : new Set();
    } catch (error) {
        console.error("Error loading favorites from localStorage: ", error);
        return new Set();
    }
};

// Helper function to format date
const formatShowDateTime = (datetime) => {
     const date = new Date(datetime);
     return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
};

// Main App Component
function App() {
    const [search, setSearch] = useState('');
    const [selectedShow, setSelectedShow] = useState('');
    const [favorites, setFavorites] = useState(new Set());
    const [activeTab, setActiveTab] = useState('program');
    const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(false);
    const [recitalData, setRecitalData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const touchStartRef = useRef(0);

    // Fetch and process data on mount
    useEffect(() => {
        fetch('recital_data.dat') // Fetch the encoded file
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.blob(); // Get the response as a Blob
            })
            .then(blob => blob.text()) // Read the Blob as text (which will be Base64)
            .then(base64String => {
                // Use a robust method to decode UTF-8 characters from Base64
                const decodedString = new TextDecoder().decode(
                    Uint8Array.from(atob(base64String), c => c.charCodeAt(0))
                );
                const data = JSON.parse(decodedString);

                // Transform the data into the key-value format the app uses
                const transformedData = data.shows.reduce((acc, show) => {
                    acc[show.datetime] = { label: formatShowDateTime(show.datetime), acts: show.acts };
                    return acc;
                }, {});
                setRecitalData(transformedData);
                setLoading(false);
            })
            .catch(error => {
                setError('Failed to load recital data. Please make sure recital_data.dat is present.');
                setLoading(false);
            });
    }, []);

    // Load favorites from localStorage
    useEffect(() => { setFavorites(loadFavoritesFromLocalStorage()); }, []);
    // Save favorites to localStorage
    useEffect(() => { saveFavoritesToLocalStorage(favorites); }, [favorites]);

    const shows = useMemo(() => {
        if (!recitalData) return [];
        return Object.keys(recitalData).map(key => ({ label: recitalData[key].label, value: key }));
    }, [recitalData]);

    const showData = selectedShow ? recitalData[selectedShow] : null;

    const searchResults = useMemo(() => {
        if (!search.trim() || !showData || !showData.acts) return [];
        const q = search.toLowerCase();
        const matchingActs = new Map();

        showData.acts.forEach(act => {
            const hasMatchingPerformer = (act.performers || []).some(name =>
                name.toLowerCase().includes(q)
            );
            if (hasMatchingPerformer) {
                if (!matchingActs.has(act.number)) {
                    matchingActs.set(act.number, act);
                }
            }
        });
        return Array.from(matchingActs.values());
    }, [search, showData]);

    const favoriteResults = useMemo(() => {
        if (!showData || !showData.acts) return [];
        const inShowMap = {};
        const allPerformers = new Set();
        showData.acts.forEach(act => {
            (act.performers || []).forEach(name => {
                allPerformers.add(name);
                if (!inShowMap[name]) inShowMap[name] = [];
                inShowMap[name].push({ number: act.number, title: act.title });
            });
        });
        return Array.from(favorites).sort().map(name => ({
            name,
            acts: inShowMap[name] || [],
            missing: !allPerformers.has(name)
        }));
    }, [favorites, showData]);
    
    const toggleFavorite = (name) => {
        setFavorites(prevFavorites => {
            const newFavorites = new Set(prevFavorites);
            newFavorites.has(name) ? newFavorites.delete(name) : newFavorites.add(name);
            return newFavorites;
        });
    };

    const handleTouchStart = (e) => { touchStartRef.current = e.targetTouches[0].clientX; };
    const handleTouchEnd = (e) => {
        const touchEnd = e.changedTouches[0].clientX;
        const delta = touchEnd - touchStartRef.current;
        if (Math.abs(delta) > 50) {
            if (delta < 0 && activeTab === 'program') setActiveTab('search');
            else if (delta > 0 && activeTab === 'search') setActiveTab('program');
        }
    };

    if (loading) return <div>Loading recital data...</div>;
    if (error) return <div>Error: {error}</div>;

    return (
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
                {selectedShow && (
                    <>
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
                                                         <div className="icon-container" style={{color: '#f59e0b'}}><Icon name="star" type="fas"/></div>
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
                        {activeTab === 'program' ? <ProgramView showData={showData} favorites={favorites} /> : <SearchView search={search} setSearch={setSearch} results={searchResults} favorites={favorites} />}
                    </>
                )}
            </main>
            <nav className="bottom-nav">
                <button onClick={() => setActiveTab('program')} className={activeTab === 'program' ? 'active' : ''}>
                   <div className="icon-container"><Icon name="list" /></div>
                    <span>Program</span>
                </button>
                <button onClick={() => setActiveTab('search')} className={activeTab === 'search' ? 'active' : ''}>
                    <div className="icon-container"><Icon name="search" /></div>
                    <span>Search</span>
                </button>
            </nav>
        </div>
    );
}

function ProgramView({ showData, favorites }) {
    if (!showData || !showData.acts) return <p style={{textAlign: 'center', color: '#6b7280', marginTop: '2rem'}}>Select a show to see the program.</p>;
    return (
        <div className="program-view">
            <h2>Program</h2>
            {showData.acts.map(act => {
                const isFavAct = (act.performers || []).some(p => favorites.has(p));
                const noPerformers = !act.performers || act.performers.length === 0;
                return (
                    <div key={act.number} className={`act-card ${isFavAct ? 'favorite' : ''} ${noPerformers ? 'no-performers' : ''}`}>
                        <p>{act.number} - {act.title}</p>
                        {!noPerformers && <div className="performers"><strong>Performers:</strong> {act.performers.join(', ')}</div>}
                    </div>
                )
            })}
        </div>
    );
}

function SearchView({ search, setSearch, results, favorites }) {
    return (
        <div className="search-view">
             <h2>Search Results</h2>
            <input type="text" placeholder="Search for a dancer..." value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && results.length === 0 && <p style={{textAlign: 'center', color: '#6b7280'}}>No dancers found matching "{search}"</p>}
            {results.length > 0 && (
                <div>
                    {results.map(act => {
                        const isFavAct = (act.performers || []).some(p => favorites.has(p));
                        const noPerformers = !act.performers || act.performers.length === 0;
                        return (
                            <div key={`${act.number}-search`} className={`act-card ${isFavAct ? 'favorite' : ''} ${noPerformers ? 'no-performers' : ''}`}>
                                <p>{act.number} - {act.title}</p>
                                {!noPerformers && <div className="performers"><strong>Performers:</strong> {act.performers.join(', ')}</div>}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
