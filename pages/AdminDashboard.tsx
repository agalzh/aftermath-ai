import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setDoc, serverTimestamp, QuerySnapshot, DocumentData, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { Waypoint, WaypointType } from '../types';
import WaypointModal from '../components/WaypointModal';
import { Observation } from '../types';
import { query, orderBy } from 'firebase/firestore';
import FlagCard from '../components/FlagCard';
import { UserRole } from '../types';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../firebase';
import { analyzeObservationClientSide } from '../utils/aiLogic'; // Adjust path if needed
import GlassSurface from '../components/GlassSurface';
import Dither from '../components/Dither';
import BlurText from '../components/BlurText';


// Replace the old MAP_STYLE string with this object
const MAP_STYLE: any = {
    version: 8,
    sources: {
        // 1. The Satellite Base
        'satellite-source': {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        },
        // 2. The Labels Overlay (Roads, Cities, Places)
        'labels-source': {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256
        }
    },
    layers: [
        {
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite-source',
            minzoom: 0,
            maxzoom: 22
        },
        {
            id: 'labels-layer',
            type: 'raster',
            source: 'labels-source',
            minzoom: 0,
            maxzoom: 22
            // No "paint" needed; these tiles are transparent PNGs with just text
        }
    ]
};

// Golden Gate Park approximate center
const INITIAL_CENTER: [number, number] = [-122.483, 37.769];
const INITIAL_ZOOM = 14;

const AdminDashboard: React.FC = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<maplibregl.Map | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
    const [observations, setObservations] = useState<Observation[]>([]);
    const allObservations = observations;

    const [isMapLoaded, setIsMapLoaded] = useState(false);

    // Interaction State
    const [isLinkingMode, setIsLinkingMode] = useState(false);
    const [linkStartId, setLinkStartId] = useState<string | null>(null);

    // Drawing State
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
    const [savedBoundary, setSavedBoundary] = useState<GeoJSON.Feature<GeoJSON.Polygon> | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWaypointId, setEditingWaypointId] = useState<string | null>(null);
    const [tempCoordinates, setTempCoordinates] = useState<{ lat: number; lng: number } | null>(null);

    const [auditLogs, setAuditLogs] = useState<any[]>([]);

    // NEW: Store user location
    const [userPos, setUserPos] = useState<[number, number] | null>(null);

    // Refs for event listener access
    const isDrawingModeRef = useRef(isDrawingMode);
    const isLinkingModeRef = useRef(isLinkingMode);

    // 5. Sync Markers
    const markersRef = useRef<{ [key: string]: maplibregl.Marker }>({});

    const handleMarkerClickRef = useRef<(id: string) => void>(() => { });

    // NEW: Function to get location and fly there
    const handleLocateMe = () => {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { longitude, latitude } = position.coords;
                const coords: [number, number] = [longitude, latitude];

                setUserPos(coords);

                if (mapInstance.current) {
                    mapInstance.current.flyTo({
                        center: coords,
                        zoom: 18 // Close zoom for satellite view
                    });
                }
            },
            (error) => {
                console.error("Error getting location:", error);
                alert("Unable to retrieve your location.");
            }
        );
    };

    useEffect(() => {
        handleMarkerClickRef.current = (id: string) => {
            if (isLinkingMode) {
                if (!linkStartId) setLinkStartId(id);
                else {
                    if (linkStartId !== id) toggleConnection(linkStartId, id);
                    setLinkStartId(null);
                }
            } else if (!isDrawingMode) {
                setEditingWaypointId(id);
                setTempCoordinates(null);
                setIsModalOpen(true);
            }
        };
    }, [isLinkingMode, linkStartId, isDrawingMode]);

    // NEW: Automatically locate on load (Optional)
    useEffect(() => {
        // Only try once when map first loads
        if (isMapLoaded) {
            handleLocateMe();
        }
    }, [isMapLoaded]);

    useEffect(() => {
        if (!db) return;

        const q = query(
            collection(db, 'observations'),
            orderBy('createdAt', 'desc')
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const obs: Observation[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<Observation, 'id'>)
            }));

            console.log('🟣 Admin received observations', obs);
            setObservations(obs);
        });

        return () => unsub();
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoadingAuth(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!db) return;

        const q = query(
            collection(db, 'auditLogs'),
            orderBy('createdAt', 'desc')
        );

        const unsub = onSnapshot(q, snap => {
            const logs = snap.docs.map(d => ({
                id: d.id,
                ...d.data()
            }));
            setAuditLogs(logs);
        });

        return () => unsub();
    }, []);

    // 1. Initialize Map
    useEffect(() => {
        if (!mapContainer.current || mapInstance.current) return;

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: MAP_STYLE,
            center: INITIAL_CENTER,
            zoom: INITIAL_ZOOM
        });

        mapInstance.current = map;

        map.on('load', () => {
            setIsMapLoaded(true);
            setTimeout(() => map.resize(), 0);

            // --- Boundary Layers ---
            if (!map.getSource('boundary')) {
                map.addSource('boundary', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });

                // Draft line (while drawing)
                map.addLayer({
                    id: 'boundary-draft',
                    type: 'line',
                    source: 'boundary',
                    paint: {
                        'line-color': '#2563eb',
                        'line-width': 2,
                        'line-dasharray': [2, 2]
                    },
                    filter: ['!=', ['geometry-type'], 'Polygon']
                });

                // Filled area (saved)
                map.addLayer({
                    id: 'boundary-fill',
                    type: 'fill',
                    source: 'boundary',
                    paint: {
                        'fill-color': '#3b82f6',
                        'fill-opacity': 0.15
                    },
                    filter: ['==', ['geometry-type'], 'Polygon']
                });

                // Outline (saved)
                map.addLayer({
                    id: 'boundary-outline',
                    type: 'line',
                    source: 'boundary',
                    paint: {
                        'line-color': '#2563eb',
                        'line-width': 2
                    },
                    filter: ['==', ['geometry-type'], 'Polygon']
                });
            }

            // --- Connection Layers ---
            if (!map.getSource('connections')) {
                map.addSource('connections', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] }
                });

                // Static connection lines
                map.addLayer({
                    id: 'connections-line',
                    type: 'line',
                    source: 'connections',
                    layout: {
                        'line-join': 'round',
                        'line-cap': 'round'
                    },
                    paint: {
                        'line-color': '#2563eb', // Slate-600
                        'line-width': 3,
                        'line-dasharray': [2, 2] // Dashed static line
                    }
                });
                map.addLayer({
                    id: 'connections-arrow',
                    type: 'symbol',
                    source: 'connections',
                    layout: {
                        'symbol-placement': 'line',      // This makes the text follow the line path
                        'text-field': '▶',               // The arrow character (you can use '>' if you prefer)
                        'text-size': 20,                 // Size of the arrow
                        'symbol-spacing': 50,            // How far apart the arrows are
                        'text-keep-upright': false,      // CRITICAL: Rotates the arrow to match the line direction
                        'text-allow-overlap': true       // Ensures arrows show even if space is tight
                    },
                    paint: {
                        'text-color': '#2563eb',         // Same color as your line (blue)
                        'text-halo-color': '#ffffff',    // White outline so it stands out
                        'text-halo-width': 2
                    }
                });
            }
        });

        // --- Map Click Handlers ---

        // Right-click: Create Waypoint (only if not drawing)
        map.on('contextmenu', (e) => {
            if (isDrawingModeRef.current || isLinkingModeRef.current) return;
            const { lat, lng } = e.lngLat;
            setTempCoordinates({ lat, lng });
            setEditingWaypointId(null);
            setIsModalOpen(true);
        });

        // Left-click: Handle Drawing
        map.on('click', (e) => {
            // If we are in drawing mode, add points
            if (isDrawingModeRef.current) {
                const { lng, lat } = e.lngLat;
                setDrawPoints(prev => [...prev, [lng, lat]]);
            }
        });

        return () => {
            map.remove();
            mapInstance.current = null;
            setIsMapLoaded(false);
        };
    }, [user]);

    useEffect(() => {
        isDrawingModeRef.current = isDrawingMode;
        isLinkingModeRef.current = isLinkingMode;
    }, [isDrawingMode, isLinkingMode]);

    // 2. Fetch Waypoints & Settings
    useEffect(() => {
        if (!db) return;

        // Fetch Waypoints
        const unsubWaypoints = onSnapshot(collection(db, 'waypoints'), (snapshot) => {
            const querySnapshot = snapshot as unknown as QuerySnapshot<DocumentData>;
            const loadedWaypoints: Waypoint[] = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name,
                    type: data.type,
                    assignedEmails: data.assignedEmails || [],
                    coordinates: data.coordinates,
                    connectedTo: data.connectedTo || [],
                    createdAt: data.createdAt
                } as Waypoint;
            });

            // SORT BY CREATION TIME (Stable Numbering)
            loadedWaypoints.sort((a, b) => {
                const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (Date.now());
                const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (Date.now());
                return tA - tB;
            });

            setWaypoints(loadedWaypoints);
        });

        // Fetch Event Config (Boundary)
        const unsubSettings = onSnapshot(doc(db, 'settings', 'event_config'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as { boundaryJson?: string };
                if (data.boundaryJson) {
                    try {
                        const parsed = JSON.parse(data.boundaryJson);
                        setSavedBoundary(parsed);
                    } catch (e) {
                        console.error("Failed to parse boundary JSON", e);
                    }
                }
            }
        });

        return () => {
            unsubWaypoints();
            unsubSettings();
        };
    }, []);

    // 3. Update Boundary Source (Live Drawing vs Saved)
    useEffect(() => {
        if (!isMapLoaded || !mapInstance.current) return;
        const map = mapInstance.current;

        if (!map.getSource('boundary')) return;

        let data: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

        if (isDrawingMode && drawPoints.length > 0) {
            // Render line while drawing, polygon if > 2 points
            if (drawPoints.length === 1) {
                data.features.push({
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'Point', coordinates: drawPoints[0] }
                });
            } else if (drawPoints.length === 2) {
                data.features.push({
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'LineString', coordinates: drawPoints }
                });
            } else {
                data.features.push({
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[...drawPoints, drawPoints[0]]] // Close the loop visually
                    }
                });
            }
        } else if (savedBoundary) {
            data.features.push(savedBoundary);
        }

        (map.getSource('boundary') as maplibregl.GeoJSONSource).setData(data);

    }, [isDrawingMode, drawPoints, savedBoundary, isMapLoaded]);

    // 4. Update Connection Lines
    useEffect(() => {
        if (!isMapLoaded || !mapInstance.current) return;
        const map = mapInstance.current;
        if (!map.getSource('connections')) return;

        const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];

        waypoints.forEach(startNode => {
            if (!startNode.connectedTo) return;

            startNode.connectedTo.forEach(targetId => {
                const targetNode = waypoints.find(w => w.id === targetId);
                if (targetNode) {
                    features.push({
                        type: 'Feature',
                        properties: {
                            source: startNode.id,
                            target: targetId
                        },
                        geometry: {
                            type: 'LineString',
                            coordinates: [
                                [startNode.coordinates.lng, startNode.coordinates.lat],
                                [targetNode.coordinates.lng, targetNode.coordinates.lat]
                            ]
                        }
                    });
                }
            });
        });

        (map.getSource('connections') as maplibregl.GeoJSONSource).setData({
            type: 'FeatureCollection',
            features
        });
    }, [waypoints, isMapLoaded]);

    useEffect(() => {
        if (!isMapLoaded || !mapInstance.current) return;
        const map = mapInstance.current;

        // Cleanup removed markers
        Object.keys(markersRef.current).forEach(id => {
            if (!waypoints.find(w => w.id === id)) {
                markersRef.current[id].remove();
                delete markersRef.current[id];
            }
        });

        // Add/Update markers
        waypoints.forEach((waypoint) => {
            let markerEl = markersRef.current[waypoint.id]?.getElement();

            if (!markerEl) {
                markerEl = createMarkerElement(waypoint);
                const marker = new maplibregl.Marker({
                    element: markerEl,
                    anchor: 'center'
                })
                    .setLngLat([waypoint.coordinates.lng, waypoint.coordinates.lat])
                    .addTo(map);

                markersRef.current[waypoint.id] = marker;
            } else {
                markersRef.current[waypoint.id].setLngLat([waypoint.coordinates.lng, waypoint.coordinates.lat]);
            }

            // Update Styles
            updateMarkerVisuals(markerEl, waypoint);
        });

    }, [waypoints, isLinkingMode, linkStartId, isMapLoaded]);

    useEffect(() => {
        if (!isMapLoaded || !mapInstance.current) return;

        // Force MapLibre to re-project markers after any marker-affecting change
        mapInstance.current.resize();
    }, [isMapLoaded, waypoints, linkStartId, isLinkingMode]);

    const processedIdsRef = useRef<Set<string>>(new Set());

    // 2. The Trigger Effect
    useEffect(() => {
        if (observations.length === 0) return;

        observations.forEach(obs => {
            // STOP if Resolved
            if (obs.status === 'RESOLVED') return;

            // STOP if we already tried this ID in this session (Prevents Loop)
            if (processedIdsRef.current.has(obs.id)) return;

            // STOP if AI is already working, done, or failed previously
            // (We do NOT retry FAILED automatically to avoid infinite API bills)
            if (obs.aiStatus === 'DONE' || obs.aiStatus === 'PROCESSING' || obs.aiStatus === 'FAILED') {
                return;
            }

            // If we get here, it's a fresh observation. Run AI.
            console.log("🤖 Auto-triggering AI for:", obs.id);

            // Mark as processed immediately
            processedIdsRef.current.add(obs.id);

            analyzeObservationClientSide(obs.id);
        });
    }, [observations]);

    // ---------------------------------------------------------------------------
    // END AI TRIGGER LOGIC
    // ---------------------------------------------------------------------------

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: any) {
            setError("Invalid credentials");
        }
    };

    const handleLogout = () => {
        signOut(auth);
    };

    if (loadingAuth) return <div className="h-full flex items-center justify-center">Loading...</div>;

    const createMarkerElement = (waypoint: Waypoint) => {
        const el = document.createElement('div');

        el.className = 'marker-root cursor-pointer shadow-md rounded-full border-2 border-white box-border group';
        // NEW: Create the Nametag Label
        const label = document.createElement('span');
        // Style: Centered above dot, dark background, white text (Minecraft style)
        label.className = 'absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black/50 text-white text-[13px] font-bold rounded whitespace-nowrap pointer-events-none backdrop-blur-sm';

        el.appendChild(label);

        // Event listener
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            handleMarkerClick(waypoint.id);
        });
        return el;
    };

    const handleMarkerClick = (id: string) => handleMarkerClickRef.current(id);

    const updateMarkerVisuals = (el: HTMLElement, waypoint: Waypoint) => {
        // color only
        el.style.backgroundColor = getWaypointColor(waypoint.type);

        // fixed size
        el.style.width = '16px';
        el.style.height = '16px';

        // fixed stacking
        el.style.zIndex = '10';

        // IMPORTANT: NEVER touch transform
        el.style.transform = '';

        // NEW: Set the label text instead of clearing innerText
        const label = el.querySelector('span');
        if (label) {
            label.innerText = waypoint.name;
        }
    };

    const getWaypointColor = (type: WaypointType) => {
        switch (type) {
            case WaypointType.ENTRY: return '#22c55e'; // Green
            case WaypointType.EXIT: return '#ef4444'; // Red
            case WaypointType.POI: return '#3b82f6'; // Blue
            case WaypointType.MEDICAL: return '#dc2626'; // Dark Red
            case WaypointType.JUNCTION: return '#eab308'; // Yellow
            default: return '#6b7280'; // Gray
        }
    };

    // --- Logic Functions ---

    const toggleConnection = async (fromId: string, toId: string) => {
        if (!db) return;
        const sourceWaypoint = waypoints.find(w => w.id === fromId);
        if (!sourceWaypoint) return;
        const isConnected = sourceWaypoint.connectedTo?.includes(toId);

        try {
            await updateDoc(doc(db, 'waypoints', fromId), {
                connectedTo: isConnected ? arrayRemove(toId) : arrayUnion(toId)
            });
        } catch (err) {
            console.error("Failed to update connection", err);
        }
    };

    const handleSaveWaypoint = async (data: { name: string; type: WaypointType; assignedEmails: string[] }) => {
        console.log('🚀 SAVING WAYPOINT', {
            data,
            tempCoordinates
        });

        if (!db) {
            alert("Database connection failed. Is the emulator running?");
            return;
        }
        try {
            if (editingWaypointId) {
                await updateDoc(doc(db, 'waypoints', editingWaypointId), {
                    name: data.name,
                    type: data.type,
                    assignedEmails: data.assignedEmails
                });

            } else if (tempCoordinates) {
                await addDoc(collection(db, 'waypoints'), {
                    name: data.name,
                    type: data.type,
                    assignedEmails: data.assignedEmails,
                    coordinates: tempCoordinates,
                    connectedTo: [],
                    createdAt: serverTimestamp()
                });
            }
        } catch (error) {
            console.error("Error saving waypoint:", error);
            alert("Failed to save waypoint. Check console for details.");
        } finally {
            setIsModalOpen(false);
        }
    };

    const handleDeleteWaypoint = async () => {
        if (!db || !editingWaypointId) return;
        if (confirm("Delete waypoint?")) {
            try {
                await deleteDoc(doc(db, 'waypoints', editingWaypointId));
                setIsModalOpen(false);
            } catch (error) { console.error(error); }
        }
    };

    const handleStartDrawing = () => {
        setIsDrawingMode(true);
        setDrawPoints([]);
        setSavedBoundary(null); // Temporarily hide saved to show new draft
    };

    const handleSaveBoundary = async () => {
        if (!db) return;
        if (drawPoints.length < 3) {
            alert("Please define at least 3 points for the area.");
            return;
        }

        // Close loop for GeoJSON
        const closedCoords = [...drawPoints, drawPoints[0]];
        const newBoundary: GeoJSON.Feature<GeoJSON.Polygon> = {
            type: "Feature",
            properties: {},
            geometry: {
                type: "Polygon",
                coordinates: [closedCoords]
            }
        };

        try {
            // FIX: Serialize to string to avoid Firestore nested array error
            await setDoc(doc(db, 'settings', 'event_config'), {
                boundaryJson: JSON.stringify(newBoundary)
            });
            setSavedBoundary(newBoundary);
        } catch (error) {
            console.error("Error saving boundary:", error);
            alert("Failed to save boundary.");
        } finally {
            setIsDrawingMode(false);
            setDrawPoints([]);
        }
    };

    const handleCancelDrawing = () => {
        setIsDrawingMode(false);
        setDrawPoints([]);
    };

    const editingWaypoint = waypoints.find(w => w.id === editingWaypointId);
    // PRIORITY SPLIT (ADD THIS ABOVE return)
    const active = observations.filter(o => o.status !== 'RESOLVED');

    const highPriority = active.filter(
        o => o.crowdLevel === 'HIGH' || o.crowdLevel === 'CRITICAL'
    );

    const lowPriority = active.filter(
        o => o.crowdLevel === 'LOW' || o.crowdLevel === 'MEDIUM'
    );

    const flaggedObservations = highPriority;

    if (!user || user.isAnonymous) {
        return (
            <div className="relative w-full h-screen bg-black overflow-hidden flex flex-col items-center justify-center font-sans">

                {/* BACKGROUND: DITHER */}
                <div className="absolute inset-0 z-0">
                    <Dither
                        waveColor={[0.5, 0.5, 0.5]}
                        disableAnimation={false}
                        enableMouseInteraction={true}
                        mouseRadius={0.3}
                        colorNum={4}
                        waveAmplitude={0.3}
                        waveFrequency={3}
                        waveSpeed={0.05}
                    />
                </div>

                {/* GLASS LOGIN CARD */}
                <div className="relative z-10 w-full max-w-sm px-4 pointer-events-none">
                    <GlassSurface
                        width="100%"
                        height="auto"
                        borderRadius={24}
                        displace={15}
                        distortionScale={-150}
                        redOffset={5}
                        greenOffset={15}
                        blueOffset={25}
                        brightness={60}
                        opacity={0.8}
                        mixBlendMode="screen"
                        className="p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                    >
                        <div className="w-full">
                            {/* Header */}
                            <div className="text-center mb-8">
                                <BlurText
                                    text="ADMIN CENTER"
                                    delay={150}
                                    className="text-3xl font-black tracking-tighter text-white drop-shadow-lg mb-2 justify-center"
                                />
                                <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-[0.3em]">
                                    Enter your credentials
                                </p>
                            </div>

                            {/* Error Display */}
                            {error && (
                                <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-3 backdrop-blur-md">
                                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                    <span className="text-xs text-red-200 font-mono">{error}</span>
                                </div>
                            )}

                            {/* Form */}
                            <form onSubmit={handleLogin} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="block text-[9px] font-bold text-cyan-200/70 uppercase tracking-widest pl-1">
                                        Email ID
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 text-white px-4 py-3 rounded-xl focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400/50 outline-none placeholder-zinc-600 transition-all font-mono text-sm shadow-inner backdrop-blur-sm pointer-events-auto"
                                        placeholder="Enter ID..."
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="block text-[9px] font-bold text-cyan-200/70 uppercase tracking-widest pl-1">
                                        Password
                                    </label>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 text-white px-4 py-3 rounded-xl focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400/50 outline-none placeholder-zinc-600 transition-all font-mono text-sm shadow-inner backdrop-blur-sm pointer-events-auto"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="group relative w-full flex justify-center py-4 px-4 border border-white/10 text-sm font-bold rounded-xl text-white bg-white/5 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] pointer-events-auto"
                                >
                                    <span className="tracking-widest">INITIALIZE</span>
                                </button>
                            </form>
                        </div>
                    </GlassSurface>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-[calc(100vh-6rem)] p-4 mt-24 ">
            <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
                <Dither
                    waveColor={[0.5, 0.5, 0.5]}
                    disableAnimation={false}
                    enableMouseInteraction={false}
                    colorNum={2}
                    waveAmplitude={0.1}
                    waveSpeed={0.02}
                />
            </div>
            <div className="relative h-full grid grid-cols-12 gap-4">

                {/* MAP PANEL */}
                <div className="col-span-8 relative rounded-lg border border-gray-300 overflow-hidden shadow-sm bg-gray-100">
                    <div ref={mapContainer} className="absolute inset-0" />

                    {/* Controls Overlay */}
                    <div className="absolute top-4 left-4 bg-zinc-900/95 backdrop-blur-sm p-4 rounded-2xl shadow-2xl border border-white/10 z-10 flex flex-col gap-3 min-w-52">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="font-bold text-white text-sm tracking-wide">Map Tools</h3>
                        </div>

                        {/* Locate Me Button */}
                        <button
                            onClick={handleLocateMe}
                            className="group w-full py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 active:scale-95 transition-all rounded-xl text-zinc-100 text-xs font-semibold flex items-center gap-3"
                        >
                            <span className="group-hover:scale-110 transition-transform">📍</span>
                            Locate Me
                        </button>

                        {/* Drawing Tools Section */}
                        {isDrawingMode ? (
                            <div className="flex flex-col gap-3 p-3 bg-zinc-800/50 rounded-xl border border-white/5 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-blue-400">Drawing Active</span>
                                    <span className="text-[10px] text-zinc-400 leading-tight">Click map to plot points</span>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveBoundary}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-bold transition-colors shadow-lg shadow-blue-900/20"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={handleCancelDrawing}
                                        className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 py-2 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={handleStartDrawing}
                                disabled={isLinkingMode}
                                className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all active:scale-95 ${isLinkingMode
                                    ? 'opacity-50 cursor-not-allowed bg-zinc-800/50 text-zinc-500'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                                    }`}
                            >
                                <span>📐</span> Draw Event Area
                            </button>
                        )}

                        {/* Linking Tools */}
                        <button
                            onClick={() => {
                                if (isDrawingMode) return;
                                setIsLinkingMode(!isLinkingMode);
                                setLinkStartId(null);
                            }}
                            disabled={isDrawingMode}
                            className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition-all active:scale-95 ${isDrawingMode
                                ? 'opacity-50 cursor-not-allowed bg-zinc-800/50 text-zinc-500'
                                : isLinkingMode
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/30 ring-1 ring-indigo-400'
                                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                                }`}
                        >
                            <span>{isLinkingMode ? '✨' : '🔗'}</span>
                            {isLinkingMode ? 'Finish Linking' : 'Link Waypoints'}
                        </button>

                        {/* Helper Footer */}
                        <div className="pt-2 mt-1 border-t border-white/5">
                            {!isDrawingMode && !isLinkingMode && (
                                <div className="text-[10px] text-zinc-500 space-y-1 font-medium">
                                    <p className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-zinc-600"></span>Right-click to Add</p>
                                    <p className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-zinc-600"></span>Left-click to Edit</p>
                                </div>
                            )}
                            {isLinkingMode && (
                                <p className="text-[10px] text-indigo-300 font-medium animate-pulse">
                                    Select two points to connect
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="absolute bottom-4 right-4 bg-zinc-900/95 backdrop-blur-sm p-3 rounded-2xl shadow-2xl border border-white/10 z-10 w-40">
                        <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                            <h3 className="font-bold text-white text-sm tracking-wide">Legend</h3>
                        </div>

                        <div className="space-y-2.5">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-[2px] bg-blue-500/20 border border-blue-500"></div>
                                <span className="text-xs font-medium text-zinc-300">Event Area</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="w-3 border-b-2 border-zinc-500 border-dashed"></div>
                                <span className="text-xs font-medium text-zinc-300">Connection</span>
                            </div>

                            {Object.values(WaypointType).map(type => (
                                <div key={type} className="flex items-center gap-3">
                                    <span className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: getWaypointColor(type) }} />
                                    <span className="text-xs font-medium text-zinc-300 capitalize">{type.toLowerCase()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* AI PANEL */}
                {/* STATUS / ACTION PANEL */}
                <div className="col-span-4 rounded-2xl border border-white/5 bg-zinc-950/20 shadow-none flex flex-col overflow-hidden">
                    <GlassSurface
                        width="100%"
                        height="100%"
                        borderRadius={16}
                        opacity={0.3}
                        className="flex flex-col overflow-hidden "
                    >
                        {/* Inner Layout Wrapper */}
                        <div className="flex flex-col w-full h-full">

                            {/* 1. HEADER: Status + Logout */}
                            <div className="p-6 flex-none border-b border-white/5 bg-white/[0.02] flex justify-between items-start">

                                {/* Left: Status Indicator */}
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <BlurText
                                            text={flaggedObservations.length > 0 ? "Critical Alert" : "System Nominal"}
                                            className={`text-sm font-medium tracking-wide ${flaggedObservations.length > 0
                                                ? "text-red-400"
                                                : "text-emerald-400" /* Keeping the green as requested */
                                                }`}
                                            delay={50}
                                        />
                                        {/* Status Dot */}
                                        <div className={`w-1.5 h-1.5 rounded-full ${flaggedObservations.length > 0
                                            ? 'bg-red-500 animate-pulse'
                                            : 'bg-emerald-500'
                                            }`} />
                                    </div>

                                    <p className="text-xs text-zinc-500 font-sans tracking-normal">
                                        {flaggedObservations.length > 0
                                            ? `${flaggedObservations.length} incidents require attention`
                                            : "Crowd density within safe parameters"
                                        }
                                    </p>
                                </div>

                                {/* Right: Logout Button */}
                                {/* Adapted to Minimalist Dark Theme (Removed bg-white to fit glass UI) */}
                                <button
                                    onClick={handleLogout}
                                    className="px-3 py-1 rounded border border-red-500/20 text-red-400 text-[10px] font-medium tracking-wider hover:bg-red-500/10 transition-colors uppercase"
                                >
                                    Logout
                                </button>

                            </div>

                            {/* 2. OBSERVATION LIST */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar relative">

                                {/* High Priority Items */}
                                {highPriority.map(obs => (
                                    <div key={obs.id} className="transition-opacity duration-200 hover:opacity-80">
                                        <FlagCard obs={obs} urgent user={user} />
                                    </div>
                                ))}

                                {/* Low Priority Items */}
                                {highPriority.length === 0 && lowPriority.map(obs => (
                                    <div key={obs.id} className="transition-opacity duration-200 hover:opacity-80">
                                        <FlagCard obs={obs} user={user} />
                                    </div>
                                ))}

                                {/* Empty State */}
                                {observations.length === 0 && (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 pointer-events-none">
                                        <span className="text-xs font-medium uppercase tracking-widest opacity-40">No Flags so far...</span>
                                    </div>
                                )}
                            </div>

                            {/* 3. ACTIVITY LOGS */}
                            <div className="h-48 flex-none bg-zinc-900/20 border-t border-white/5 flex flex-col backdrop-blur-md">
                                <div className="px-6 py-3 border-b border-white/5">
                                    <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Activity Feed</span>
                                </div>

                                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 custom-scrollbar">
                                    {auditLogs.map(log => (
                                        <div
                                            key={log.id}
                                            className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors shadow-sm"
                                        >
                                            {/* Header: Action + Time */}
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className="text-xs font-semibold text-zinc-200">
                                                    {log.action}
                                                </span>
                                                <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                                                    {log.createdAt?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || '--:--'}
                                                </span>
                                            </div>

                                            {/* Body: Message */}
                                            {log.message && (
                                                <p className="text-xs text-zinc-400 leading-snug">
                                                    {log.message}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </GlassSurface>
                </div>
            </div>

            <WaypointModal
                isOpen={isModalOpen}
                isEditMode={!!editingWaypointId}
                initialData={editingWaypoint ? {
                    name: editingWaypoint.name,
                    type: editingWaypoint.type,
                    assignedEmails: editingWaypoint.assignedEmails || []
                } : undefined}
                onClose={() => setIsModalOpen(false)}
                onSave={(data) => {
                    console.log('🔵 AdminDashboard received onSave', data);
                    handleSaveWaypoint(data);
                }}
                onDelete={handleDeleteWaypoint}
            />

        </div>
    );
};

export default AdminDashboard;

